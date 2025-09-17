// server/src/ws.js
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

/**
 * Minimal WS hub:
 * - /ingest  : device agents send JSON lines (logs) + periodic {type:'snapshot'} frames
 * - /live    : browser viewers receive real-time logs for a device
 *
 * We also keep a tiny in-memory snapshot store for the Summary panel.
 */

const LOG_ROOT = path.join(process.cwd(), "logs");

// deviceId -> { device_id, snapshot?, _serverTs, control?, online? }
const deviceState = new Map();

// deviceId -> Set<WebSocket> viewers
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

/** public accessor used by the REST route */
export function getDeviceSummary(deviceId) {
  const s = deviceState.get(deviceId);
  if (!s) {
    return { device_id: deviceId, online: false };
  }
  const age = Date.now() - (s._serverTs || 0);
  const online = age < 20_000; // 20s heartbeat window
  return {
    device_id: deviceId,
    online,
    snapshot: s.snapshot || null,
    // keep flat copies for older client shapes
    os: s.snapshot?.os || null,
    ips: s.snapshot?.ips || [],
    runtime: s.snapshot?.runtime || "",
    containers: s.snapshot?.containers || [],
    _serverTs: s._serverTs || Date.now(),
    control: s.control || { enabled: false },
  };
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
      // viewer
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

      // ensure a state record exists
      if (!deviceState.has(deviceId)) {
        deviceState.set(deviceId, {
          device_id: deviceId,
          snapshot: null,
          _serverTs: Date.now(),
          control: { enabled: false }, // keep disabled until you wire remote control
        });
      }

      ws.on("message", (data) => {
        const text = data.toString();
        // bump heartbeat
        const s = deviceState.get(deviceId) || { device_id: deviceId };
        s._serverTs = Date.now();

        // snapshot frames or log lines?
        let parsed = null;
        try { parsed = JSON.parse(text); } catch {}

        if (parsed && parsed.type === "snapshot") {
          s.snapshot = parsed;
          deviceState.set(deviceId, s);
          return; // snapshot not forwarded to viewers
        }

        // normal log line: persist + fan-out
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
        // keep last snapshot; online/offline is derived by age in getDeviceSummary()
        console.log("[ws] ingest disconnected:", deviceId);
      });
    }
  });
}
