// server/src/ws.js
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const LOG_ROOT = path.join(process.cwd(), "logs");

// deviceId -> { device_id, snapshot?, _serverTs, control? }
const deviceState = new Map();

// deviceId -> Set<WebSocket> (viewers)
const viewers = new Map();

// deviceId -> WebSocket (ingest/device connection) for control
const ingesters = new Map();

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
  if (!s) return { device_id: deviceId, online: false };

  const age = Date.now() - (s._serverTs || 0);
  const online = age < 20_000;

  // Prefer control reported in snapshot; otherwise fall back to state.
  const controlMerged =
    (s.snapshot && s.snapshot.control) ||
    s.control ||
    { enabled: false };

  return {
    device_id: deviceId,
    online,
    snapshot: s.snapshot || null,
    os: s.snapshot?.os || null,
    ips: s.snapshot?.ips || [],
    runtime: s.snapshot?.runtime || "",
    containers: s.snapshot?.containers || [],
    _serverTs: s._serverTs || Date.now(),
    control: controlMerged,
  };
}

/** send a control frame to a connected device (returns true if delivered) */
export function sendControl(deviceId, payload) {
  const ws = ingesters.get(deviceId);
  if (!ws || ws.readyState !== ws.OPEN) return false;
  try {
    ws.send(JSON.stringify({ type: "control", ...payload }));
    console.log("[ws] control ->", deviceId, payload);
    return true;
  } catch {
    return false;
  }
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
      ingesters.set(deviceId, ws);

      if (!deviceState.has(deviceId)) {
        deviceState.set(deviceId, {
          device_id: deviceId,
          snapshot: null,
          _serverTs: Date.now(),
          control: { enabled: false },
        });
      }

      ws.on("message", (data) => {
        const text = data.toString();
        const s = deviceState.get(deviceId) || { device_id: deviceId };
        s._serverTs = Date.now();

        let parsed = null;
        try { parsed = JSON.parse(text); } catch {}

        // Capabilities / hello
        if (parsed && parsed.type === "hello") {
          const enabled = !!(parsed.control && parsed.control.enabled);
          s.control = { enabled };
          deviceState.set(deviceId, s);
          console.log("[ws] hello ctl=", enabled, deviceId);
          return;
        }

        // Snapshot (may also carry control)
        if (parsed && parsed.type === "snapshot") {
          s.snapshot = parsed;
          if (parsed.control) {
            const enabled = !!parsed.control.enabled;
            s.control = { enabled };
            console.log("[ws] snapshot ctl=", enabled, deviceId);
          }
          deviceState.set(deviceId, s);
          return;
        }

        // Log line -> persist + fan-out
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
        ingesters.delete(deviceId);
        console.log("[ws] ingest disconnected:", deviceId);
      });
    }
  });
}
