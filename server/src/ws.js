// server/src/ws.js
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

/**
 * WS hub:
 * - /ingest  : device agents send JSON lines (+ periodic {type:'snapshot'})
 * - /live    : browsers subscribe to live logs
 * Also keeps a tiny in-memory snapshot store for Summary + Devices list.
 */

const LOG_ROOT = path.join(process.cwd(), "logs");

// deviceId -> { device_id, snapshot?, _serverTs, control? }
const deviceState = new Map();

// deviceId -> Set<WebSocket> (viewers)
const viewers = new Map();

function appendLine(deviceId, line) {
  try {
    const dir = path.join(LOG_ROOT, deviceId);
    fs.mkdirSync(dir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const file = path.join(dir, `${day}.jsonl`);
    fs.appendFile(file, line + "\n", () => {});
  } catch (e) {
    console.error("[ws] append error:", e);
  }
}

/** Summary for one device (used by REST /summary) */
export function getDeviceSummary(deviceId) {
  const s = deviceState.get(deviceId);
  if (!s) return { device_id: deviceId, online: false };

  const age = Date.now() - (s._serverTs || 0);
  const online = age < 20_000;

  return {
    device_id: deviceId,
    online,
    snapshot: s.snapshot || null,
    os: s.snapshot?.os || null,
    ips: s.snapshot?.ips || [],
    runtime: s.snapshot?.runtime || "",
    containers: s.snapshot?.containers || [],
    _serverTs: s._serverTs || Date.now(),
    control: s.control || { enabled: false },
  };
}

/** List of devices (used by REST GET /api/devices) */
export function listDevices() {
  const rows = [];
  const now = Date.now();

  for (const [id, s] of deviceState.entries()) {
    const last = s._serverTs || 0;
    const online = now - last < 20_000;

    const os = s.snapshot?.os || {};
    const osName = os.name || "";
    const osVersion = os.version || osName;
    const osVariant =
      /dev(elopment)?/i.test(os.version || "") || /dev/i.test(os.build || "")
        ? "development"
        : "";

    // We don’t force a hostname in the agent—fall back to id.
    const name =
      s.snapshot?.hostname ||
      s.snapshot?.os?.hostname ||
      id; // safe fallback

    rows.push({
      device_id: id,
      name,
      uuid: id.slice(0, 6),
      online,
      lastSeen: last,
      osVersion,
      osVariant,
    });
  }

  // Most recent first
  rows.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  return rows;
}

export function setupWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host}`);
    } catch {
      socket.destroy();
      return;
    }
    const pathname = url.pathname;
    if (pathname !== "/ingest" && pathname !== "/live") return;

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.pathname = pathname;
      ws.deviceId = url.searchParams.get("device_id") || "unknown";
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    const { pathname, deviceId } = ws;

    if (pathname === "/live") {
      let set = viewers.get(deviceId);
      if (!set) viewers.set(deviceId, (set = new Set()));
      set.add(ws);

      ws.on("close", () => {
        set.delete(ws);
        if (set.size === 0) viewers.delete(deviceId);
      });
      return;
    }

    if (pathname === "/ingest") {
      console.log("[ws] ingest connected:", deviceId);

      // ensure state exists
      if (!deviceState.has(deviceId)) {
        deviceState.set(deviceId, {
          device_id: deviceId,
          snapshot: null,
          _serverTs: Date.now(),
          control: { enabled: process.env.CONTROL_ENABLED === "1" },
        });
      }

      ws.on("message", (data) => {
        const text = data.toString();
        const s = deviceState.get(deviceId) || { device_id: deviceId };
        s._serverTs = Date.now();

        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch {}

        if (parsed && parsed.type === "snapshot") {
          s.snapshot = parsed;
          deviceState.set(deviceId, s);
          return; // snapshots are not broadcast to viewers
        }

        appendLine(deviceId, text);
        deviceState.set(deviceId, s);

        const set = viewers.get(deviceId);
        if (set) {
          for (const v of set) {
            if (v.readyState === v.OPEN) v.send(text);
          }
        }
      });

      ws.on("close", () => {
        console.log("[ws] ingest disconnected:", deviceId);
      });
    }
  });
}
