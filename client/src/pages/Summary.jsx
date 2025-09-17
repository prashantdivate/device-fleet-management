import React from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import LiveLogs from "../modules/LiveLogs.jsx";
import SshTerminal from "../modules/SshTerminal.jsx";

export default function Summary() {
  const {
    deviceId, setDeviceId,
    sshHost, setSshHost,
    sshUser, setSshUser,
    sshPort, setSshPort,
    sshPass, setSshPass,
  } = useSession();

  return (
    <div className="summary-grid">
      {/* Left info card (kept minimal) */}
      <div className="card summary-card">
        <div className="card-header"><h3>Device Summary</h3></div>
        <div className="hint">Use the right-side cards to set Device ID for logs and SSH details for the terminal.</div>
      </div>

      {/* Logs card */}
      <div className="card logs-card">
        <div className="card-header">
          <h3>Logs</h3>
          <span className="pill">{deviceId || "—"}</span>
        </div>

        {/* Moved here: Device ID input (Summary page only) */}
        <div className="logs-controls">
          <label style={{fontSize:12, color:"#334155"}}>Device ID</label>
          <input
            className="id-input"
            value={deviceId}
            onChange={(e)=>setDeviceId(e.target.value)}
            placeholder="MACHINE_ID or label"
          />
        </div>

        <LiveLogs />
      </div>

      {/* Terminal card */}
      <div className="card term-card">
        <div className="card-header"><h3>Device Terminal</h3></div>

        {/* SSH fields */}
        <div className="term-fields">
          <input placeholder="SSH Host" value={sshHost} onChange={(e)=>setSshHost(e.target.value)} />
          <input placeholder="User" value={sshUser} onChange={(e)=>setSshUser(e.target.value)} />
          <input placeholder="Port" value={sshPort} onChange={(e)=>setSshPort(e.target.value)} />
          <input placeholder="Password (prototype)" type="password" value={sshPass} onChange={(e)=>setSshPass(e.target.value)} />
        </div>

        {/* Give the terminal a container with height */}
        <div className="term-shell">
          <SshTerminal />
        </div>
      </div>
    </div>
  );
}

