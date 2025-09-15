import React from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import LiveLogs from "../modules/LiveLogs.jsx";

export default function Logs() {
  const { deviceId } = useSession();
  return (
    <section className="card fill">
      <div className="card-header">
        <h3>Live Logs</h3>
        <div className="pill">{deviceId || "no device selected"}</div>
      </div>
      <LiveLogs deviceId={deviceId} />
    </section>
  );
}

