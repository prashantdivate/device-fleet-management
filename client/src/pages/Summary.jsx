import React from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import LiveLogs from "../modules/LiveLogs.jsx";
import SshTerminal from "../modules/SshTerminal.jsx";

/* Layout: left = Device Summary card (like balena),
   right top = Logs (fixed height), right bottom = Terminal. */
export default function Summary() {
  const { deviceId, setDeviceId, ssh, setSsh } = useSession();

  return (
    <div className="summary-grid">
      <section className="card summary-card">
        <div className="card-header">
          <h3>Device Summary</h3>
        </div>

        <div className="summary-form">
          <div className="row">
            <div className="col">
              <label>Device ID</label>
              <input value={deviceId} onChange={(e)=>setDeviceId(e.target.value)} placeholder="MACHINE_ID or label" />
            </div>
          </div>

          <div className="row">
            <div className="col">
              <label>SSH Host</label>
              <input value={ssh.host||""} onChange={(e)=>setSsh({...ssh, host:e.target.value})} placeholder="192.168.x.x" />
            </div>
            <div className="col">
              <label>User</label>
              <input value={ssh.user||"root"} onChange={(e)=>setSsh({...ssh, user:e.target.value})} />
            </div>
            <div className="col">
              <label>Port</label>
              <input type="number" value={ssh.port||22} onChange={(e)=>setSsh({...ssh, port:parseInt(e.target.value||"22",10)})} />
            </div>
          </div>

          <div className="row">
            <div className="col">
              <label>Password (prototype)</label>
              <input type="password" value={ssh.password||""} onChange={(e)=>setSsh({...ssh, password:e.target.value})} />
              <p className="hint" style={{marginTop:8}}>For demo only. Prefer SSH keys + TLS in production.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card logs-card">
        <div className="card-header">
          <h3>Logs</h3>
          <div className="pill">{deviceId || "no device selected"}</div>
        </div>
        <LiveLogs deviceId={deviceId} />
      </section>

      <section className="card term-card">
        <div className="card-header">
          <h3>Terminal</h3>
          <div className="pill">{ssh.host || "no host"}</div>
        </div>
        <SshTerminal {...ssh} />
      </section>
    </div>
  );
}

