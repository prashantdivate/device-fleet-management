import React, { useEffect, useState } from "react";
import { useSession } from "../ctx/SessionContext.jsx";

function StatusPill({ status }) {
  const ok = status === "online";
  return (
    <span className={"pill " + (ok ? "pill-ok" : "pill-off")}>
      {ok ? "Online" : "Offline"}
    </span>
  );
}

export default function Devices() {
  const { setDeviceId } = useSession();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/devices").then(r => r.json()).then(d => {
      setRows(d.devices || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <section className="card fill">
      <div className="card-header">
        <h3>Devices</h3>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name / ID</th>
              <th>Last Seen</th>
              <th>OS Version</th>
              <th>Supervisor</th>
              <th>IP Address</th>
              <th>Current Release</th>
              <th>Target Release</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan="8" style={{textAlign:"center"}}>Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan="8" style={{textAlign:"center"}}>No devices yet.</td></tr>
            )}
            {rows.map((d) => (
              <tr key={d.id} onClick={() => setDeviceId(d.id)} style={{cursor:"pointer"}}>
                <td><StatusPill status={d.status} /></td>
                <td>{d.id}</td>
                <td>{d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}</td>
                <td>{d.os_version ?? "—"}</td>
                <td>{d.supervisor_version ?? "—"}</td>
                <td>{d.ip_address ?? "—"}</td>
                <td>{d.current_release ?? "—"}</td>
                <td>{d.target_release ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

