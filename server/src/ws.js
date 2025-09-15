// WebSocket endpoints:
// - /ingest?device_id=... : Fluent Bit websocket output pushes JSON lines here
// - /live?device_id=...   : Browser subscribes to live logs (returns recent tail first)
// - /ssh?host=...&user=...&port=... : Browser opens a terminal; server dials SSH and proxies data
import { WebSocketServer } from "ws";
import { URL } from "url";
import fs from "fs";
import path from "path";
import { Client as SSHClient } from "ssh2";

const tails = new Map(); // deviceId -> array of lines
const MAX_TAIL = 1000;

function appendLine(deviceId, line) {
  const dir = path.join(process.cwd(), "logs", deviceId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, new Date().toISOString().slice(0,10) + ".jsonl");
  fs.appendFile(file, line + "\n", () => {});
  const buf = tails.get(deviceId) || [];
  buf.push(line);
  if (buf.length > MAX_TAIL) buf.shift();
  tails.set(deviceId, buf);
}

export function setupWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://local");
    const pathname = url.pathname;

    if (pathname === "/ingest") {
      const deviceId = url.searchParams.get("device_id") || "unknown";
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._role = "ingest";
        ws._deviceId = deviceId;
        ws.on("message", (data) => {
          const line = data.toString();
          appendLine(deviceId, line);
          // fan out to viewers
          wss.clients.forEach((c) => {
            if (c.readyState === 1 && c._role === "viewer" && c._deviceId === deviceId) {
              c.send(line);
            }
          });
        });
      });
      return;
    }

    if (pathname === "/live") {
      const deviceId = url.searchParams.get("device_id");
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._role = "viewer";
        ws._deviceId = deviceId;
        (tails.get(deviceId) || []).forEach((l) => ws.send(l));
      });
      return;
    }

    if (pathname === "/ssh") {
      const host = url.searchParams.get("host");
      const user = url.searchParams.get("user") || process.env.SSH_USER || "root";
      const port = parseInt(url.searchParams.get("port") || process.env.SSH_PORT || "22", 10);
      const password = url.searchParams.get("password") || undefined;
      // Optional: private key support later

      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._role = "ssh";
        const conn = new SSHClient();
        conn.on("ready", () => {
          conn.shell((err, stream) => {
            if (err) {
              ws.send(JSON.stringify({ type: "error", message: String(err) }));
              ws.close();
              conn.end();
              return;
            }
            ws.send(JSON.stringify({ type: "status", message: "SSH connected" }));
            // wire data both ways
            stream.on("data", (d) => ws.readyState === 1 && ws.send(d));
            stream.stderr.on("data", (d) => ws.readyState === 1 && ws.send(d));
            ws.on("message", (data) => stream.write(data));
            ws.on("close", () => conn.end());
          });
        }).on("error", (e) => {
          ws.readyState === 1 && ws.send(JSON.stringify({ type: "error", message: e.message }));
          ws.close();
        }).connect({ host, port, username: user, password });
      });
      return;
    }

    socket.destroy();
  });
}
