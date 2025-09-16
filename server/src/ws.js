// server/src/ws.js
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";

const LOG_ROOT = path.join(process.cwd(), "logs");

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

export function setupWs(server) {
  // One WSS we attach manually for selected paths.
  const wss = new WebSocketServer({ noServer: true });

  // deviceId -> Set<WebSocket> (viewers)
  const viewers = new Map();

  server.on("upgrade", (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host}`);
    } catch {
      socket.destroy();
      return;
    }
    const pathname = url.pathname;

    if (pathname !== "/ingest" && pathname !== "/live") {
      // Not a WS endpoint we handle; let Express/HTTP deal with it
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.pathname = pathname;
      ws.deviceId = url.searchParams.get("device_id") || "unknown";
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    const { pathname, deviceId } = ws;
    if (pathname === "/live") {
      console.log("[ws] viewer connected:", deviceId);
      let set = viewers.get(deviceId);
      if (!set) viewers.set(deviceId, (set = new Set()));
      set.add(ws);

      ws.on("close", () => {
        set.delete(ws);
        if (set.size === 0) viewers.delete(deviceId);
        console.log("[ws] viewer disconnected:", deviceId);
      });
      return;
    }

    if (pathname === "/ingest") {
      console.log("[ws] ingest connected:", deviceId);

      ws.on("message", (data) => {
        const line = data.toString();
        // console.log("[ws] ingest msg", deviceId, line.slice(0, 80));
        appendLine(deviceId, line);

        const set = viewers.get(deviceId);
        if (set) {
          for (const v of set) {
            if (v.readyState === v.OPEN) v.send(line);
          }
        }
      });

      ws.on("close", () => {
        console.log("[ws] ingest disconnected:", deviceId);
      });
      return;
    }
  });
}

