import React from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import LiveLogs from "../modules/LiveLogs.jsx";
import SshTerminal from "../modules/SshTerminal.jsx";

export default function Overview() {
  const { deviceId, ssh } = useSession();
  return (
    <>
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
    </>
  );
}

