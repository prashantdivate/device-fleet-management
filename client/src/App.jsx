import React, { useMemo, useState } from "react";
import LiveLogs from "./modules/LiveLogs.jsx";
import SshTerminal from "./modules/SshTerminal.jsx";

export default function App() {
  const [deviceId, setDeviceId] = useState("");
  const [ssh, setSsh] = useState({ host: "", user: "root", password: "", port: 22 });

  return (
    <div className="page">
      <aside className="sidebar">
        <h2 className="title">Device Summary</h2>
        <div className="section">
          <label>Device ID</label>
          <input value={deviceId} onChange={e=>setDeviceId(e.target.value)} placeholder="MACHINE_ID or any label" />
        </div>

        <div className="section">
          <label>SSH Host</label>
          <input value={ssh.host} onChange={e=>setSsh({...ssh, host:e.target.value})} placeholder="192.168.x.x" />
          <div className="row">
            <div className="col">
              <label>User</label>
              <input value={ssh.user} onChange={e=>setSsh({...ssh, user:e.target.value})} />
            </div>
            <div className="col">
              <label>Port</label>
              <input type="number" value={ssh.port} onChange={e=>setSsh({...ssh, port:parseInt(e.target.value||'22',10)})} />
            </div>
          </div>
          <label>Password (prototype)</label>
          <input type="password" value={ssh.password} onChange={e=>setSsh({...ssh, password:e.target.value})} />
          <p className="hint">For demo only. Prefer SSH keys + TLS in production.</p>
        </div>
      </aside>

      <main className="right">
        <section className="card logs-card">
          <div className="card-header">
            <h3>Realtime Logs</h3>
            <div className="pill">{deviceId || "no device selected"}</div>
          </div>
          <LiveLogs deviceId={deviceId} />
        </section>

        <section className="card term-card">
          <div className="card-header">
            <h3>Device Terminal</h3>
            <div className="pill">{ssh.host || "no host"}</div>
          </div>
          <SshTerminal {...ssh} />
        </section>
      </main>
    </div>
  );
}
