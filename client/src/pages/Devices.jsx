// src/pages/Devices.jsx
import React, { useEffect, useMemo, useState } from "react";
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

  // filters
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'online' | 'offline'

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // default 10

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`http://${host}:4000/api/devices`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        const list = Array.isArray(data?.devices) ? data.devices : [];
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [host]);

  const onOpen = (id) => {
    if (!id) return;
    setDeviceId(id);
    navigate(`/summary/${encodeURIComponent(id)}`);
  };

  // --- Filtering ---
  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    const tokens = q ? q.split(/\s+/) : [];
    const statusOk = (d) =>
      statusFilter === "all" ||
      (statusFilter === "online" ? d.online : !d.online);

    return rows.filter((d) => {
      if (!statusOk(d)) return false;
      if (tokens.length === 0) return true;

      const bag = [
        d.name,
        d.device_id,
        d.uuid,
        d.osVersion,
        d.osVariant,
        d.online ? "online" : "offline",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return tokens.every((t) => bag.includes(t));
    });
  }, [rows, query, statusFilter]);

  // --- Pagination (on filtered data) ---
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);
  const pageRows = filtered.slice(startIdx, endIdx);

  // reset page when filters or size change
  useEffect(() => { setPage(1); }, [query, statusFilter, pageSize, rows.length]);

  const countLabel =
    query.trim() || statusFilter !== "all"
      ? `${filtered.length} of ${rows.length} device(s)`
      : `${rows.length} device(s)`;

  const controlBoxStyle = {
    padding: "6px 8px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    color: "#0f172a",
    fontSize: 14,
  };

  return (
    <div className="card">
      <div className="card-header" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>Devices Overview</h3>

        {/* right side: count + search + status filter */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 12, color: "#475569" }}>{countLabel}</div>

          {/* filter only online/offline */}
          {/* <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={controlBoxStyle}
            title="Filter by status"
          >
            <option value="all">All</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select> */}

          <input
            className="id-input"
            placeholder="Search devices…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 280 }}
            title="Search by name, id, uuid, OS, variant, online/offline"
          />
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
              <tr><td colSpan={6} style={{ color: "#64748b" }}>Loading…</td></tr>
            )}

            {!loading && err && (
              <tr><td colSpan={6} style={{ color: "#b91c1c" }}>
                Failed to load devices: {err}
              </td></tr>
            )}

            {!loading && !err && pageRows.length === 0 && (
              <tr><td colSpan={6} style={{ color: "#64748b" }}>
                {rows.length === 0 ? "No devices yet." : "No matching devices."}
              </td></tr>
            )}

            {!loading && !err && pageRows.map((d) => (
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
                    href={`/summary/${encodeURIComponent(d.device_id)}`}
                    onClick={(e) => { e.preventDefault(); onOpen(d.device_id); }}
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
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        paddingTop: 10,
        borderTop: "1px solid #e5e7eb",
        color: "#64748b"
      }}>
        <div>
          {filtered.length === 0
            ? "Showing 0 devices"
            : `Showing ${startIdx + 1}–${endIdx} of ${filtered.length} devices`}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            title="First"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >⏮</button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            title="Previous"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >‹</button>
          <button
            onClick={() => setPage(p => Math.min(pageCount, p + 1))}
            disabled={safePage === pageCount}
            title="Next"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >›</button>
          <button
            onClick={() => setPage(pageCount)}
            disabled={safePage === pageCount}
            title="Last"
            style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}
          >⏭</button>

          <span>Go to</span>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={safePage}
            onChange={(e) => {
              const v = Number(e.target.value || 1);
              setPage(Math.min(Math.max(1, v), pageCount));
            }}
            style={{ width: 64, ...controlBoxStyle, padding: "6px 6px" }}
          />

          <div style={{ width: 1, height: 22, background: "#e5e7eb", margin: "0 6px" }} />

          <span>Devices per page</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={controlBoxStyle}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  );
}
