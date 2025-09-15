
import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

const WS_BASE = import.meta.env.VITE_WS_BASE || `ws://${location.hostname}:4000`;
const HTTP_BASE = WS_BASE.replace(/^ws/, "http");

function LogsPanel() {
  const [deviceId, setDeviceId] = useState("");
  const [devices, setDevices] = useState([]);
  const [lines, setLines] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    fetch(`${HTTP_BASE}/api/devices`).then((r) => r.json()).then(setDevices).catch(() => {});
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const connect = () => {
    if (!deviceId) return;
    wsRef.current?.close();
    const ws = new WebSocket(`${WS_BASE}/live?device_id=${encodeURIComponent(deviceId)}`);
    wsRef.current = ws;
    ws.onmessage = (e) => setLines((prev) => [...prev, e.data].slice(-2000));
  };

  return (
    <div className="card" style={{ height: "48%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, flex: 1 }}>Realtime Logs</h3>
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          <option value="">Select device</option>
          {devices.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={connect}>Connect</button>
      </div>
      <pre className="logs-pane">{lines.join("\n")}</pre>
    </div>
  );
}

function TerminalPanel() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const [conn, setConn] = useState({ host: "", port: 22, user: "", password: "" });
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({ convertEol: true, cursorBlink: true, fontFamily: "monospace", fontSize: 13 });
    term.open(containerRef.current);
    termRef.current = term;
    term.writeln("▼ SSH terminal (prototype). Enter host/user/password and press Connect.");
    return () => term.dispose();
  }, []);

  const connect = () => {
    wsRef.current?.close();
    const qs = new URLSearchParams({ host: conn.host, port: String(conn.port || 22), user: conn.user, password: conn.password });
    const ws = new WebSocket(`${WS_BASE}/term?${qs}`);
    wsRef.current = ws;
    ws.onmessage = (e) => termRef.current?.write(e.data);
    ws.onopen = () => termRef.current?.writeln("\r\n[connected]\r\n");
    ws.onclose = () => termRef.current?.writeln("\r\n[disconnected]\r\n");
    termRef.current?.onData((d) => ws.send(d));
  };

  return (
    <div className="card" style={{ height: "48%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, flex: 1 }}>SSH Terminal</h3>
        <input placeholder="host (ip or name)" value={conn.host} onChange={(e)=>setConn({...conn, host:e.target.value})} style={{ width: 180 }} />
        <input placeholder="port" type="number" value={conn.port} onChange={(e)=>setConn({...conn, port: Number(e.target.value)})} style={{ width: 80 }} />
        <input placeholder="user" value={conn.user} onChange={(e)=>setConn({...conn, user:e.target.value})} style={{ width: 120 }} />
        <input placeholder="password" type="password" value={conn.password} onChange={(e)=>setConn({...conn, password:e.target.value})} style={{ width: 140 }} />
        <button onClick={connect}>Connect</button>
      </div>
      <div ref={containerRef} className="term-pane" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="home-layout">
      <aside className="left">
        <div className="card">
          <h3>Device Summary</h3>
          <ul className="summary">
            <li>Status: <strong>Online</strong></li>
            <li>OS: <strong>Yocto/OSTree</strong></li>
            <li>Supervisor: <strong>Prototype</strong></li>
          </ul>
        </div>
        <div className="card">
          <h3>Actions</h3>
          <button disabled>Reboot (stub)</button>
          <button disabled>Restart Service (stub)</button>
        </div>
      </aside>
      <section className="right">
        <LogsPanel />
        <TerminalPanel />
      </section>
    </div>
  );
}
