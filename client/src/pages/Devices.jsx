import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "../ctx/SessionContext.jsx";

// tiny relative-time helper
function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusDot({ online }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 999,
        marginRight: 8,
        background: online ? "#16a34a" : "#ef4444",
        boxShadow: "0 0 0 1px rgba(0,0,0,.08) inset",
      }}
      title={online ? "Online" : "Offline"}
    />
  );
}

export default function Devices() {
  const navigate = useNavigate();
  const { setDeviceId } = useSession();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`http://${host}:4000/api/devices`);
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const data = await r.json();
        // Defensive: the API returns { devices: [...] }
        const list = Array.isArray(data?.devices) ? data.devices : [];
        if (!cancelled) {
          setRows(list);
        }
        // helpful for debugging if something goes wrong
        console.debug("[Devices] /api/devices ->", data);
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 5000); // light polling, keeps "Last seen" fresh
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [host]);

  const onOpen = (id) => {
    if (!id) return;
    setDeviceId(id);
    try {
      navigate("/summary");
    } catch {
      // if router isn't present, just ignore
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 style={{ margin: 0 }}>Devices</h3>
        <div style={{ fontSize: 12, color: "#475569" }}>
          {rows.length} device(s)
        </div>
      </div>

      <div className="table-wrap">
        <table className="table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Status</th>
              <th>Name</th>
              <th style={{ width: 160 }}>Last Seen</th>
              <th style={{ width: 120 }}>UUID</th>
              <th style={{ width: 280 }}>OS Version</th>
              <th style={{ width: 140 }}>OS Variant</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} style={{ color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && err && (
              <tr>
                <td colSpan={6} style={{ color: "#b91c1c" }}>
                  Failed to load devices: {err}
                </td>
              </tr>
            )}

            {!loading && !err && rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: "#64748b" }}>
                  No devices yet.
                </td>
              </tr>
            )}

            {!loading &&
              !err &&
              rows.map((d) => (
                <tr
                  key={d.device_id}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpen(d.device_id)}
                >
                  <td>
                    <StatusDot online={d.online} />
                    {d.online ? "Online" : "Offline"}
                  </td>
                  <td>
                    <a
                      onClick={(e) => {
                        e.preventDefault();
                        onOpen(d.device_id);
                      }}
                      href="#"
                      style={{ color: "#1d4ed8", textDecoration: "none", fontWeight: 600 }}
                    >
                      {d.name || d.device_id}
                    </a>
                  </td>
                  <td>{timeAgo(d.lastSeen)}</td>
                  <td>
                    <span
                      style={{
                        background: "#fee2e2",
                        color: "#991b1b",
                        padding: "2px 6px",
                        borderRadius: 6,
                        border: "1px solid #fecaca",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {d.uuid || (d.device_id || "").slice(0, 6)}
                    </span>
                  </td>
                  <td>{d.osVersion || "—"}</td>
                  <td>
                    {d.osVariant ? (
                      <span
                        style={{
                          background: "#fef3c7",
                          color: "#92400e",
                          padding: "2px 6px",
                          borderRadius: 6,
                          border: "1px solid #fde68a",
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "none",
                        }}
                      >
                        {d.osVariant}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
