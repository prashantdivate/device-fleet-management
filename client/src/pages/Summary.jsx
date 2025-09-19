import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useSession } from "../ctx/SessionContext.jsx";
import LiveLogs from "../modules/LiveLogs.jsx";
import SshTerminal from "../modules/SshTerminal.jsx";
import rebootIconUrl from "./icons/shutdown.svg";
import "./summary.css";

export default function Summary() {
  const {
    deviceId, setDeviceId,
    sshHost, setSshHost,
    sshUser, setSshUser,
    sshPort, setSshPort,
    sshPass, setSshPass,
  } = useSession();

  // --- NEW: adopt ID from URL ( /summary/:id or ?device_id= ) and keep URL in sync
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  const routeId =
    (params?.id && decodeURIComponent(params.id)) ||
    search.get("device_id") ||
    null;

  useEffect(() => {
    if (routeId && routeId !== deviceId) setDeviceId(routeId);
  }, [routeId, deviceId, setDeviceId]);

  useEffect(() => {
    if (!deviceId) return;
    if (params?.id !== deviceId) {
      navigate(`/summary/${encodeURIComponent(deviceId)}`, { replace: true });
    }
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- LEFT CARD STATE ---------- */
  const [sum, setSum] = useState(null);
  const [loading, setLoading] = useState(false);
  const wsRef = useRef(null);

  const host = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const proto = typeof window !== "undefined" ? window.location.protocol : "http:";
  const apiBase = `${proto}//${host}:4000`;

  // HTTP poll (every 5s)
  useEffect(() => {
    let stop = false;
    if (!deviceId) { setSum(null); return; }

    const fetchOnce = async () => {
      try {
        setLoading(true);
        const r = await fetch(`${apiBase}/api/devices/${encodeURIComponent(deviceId)}/summary`);
        if (!r.ok) throw new Error(r.statusText);
        const j = await r.json();
        if (!stop) setSum(j);
      } catch (e) {
        if (!stop) setSum((prev) => prev || null);
      } finally {
        if (!stop) setLoading(false);
      }
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [deviceId, apiBase]);

  // WS live snapshots
  useEffect(() => {
    if (!deviceId) return;
    try { wsRef.current?.close(); } catch {}
    const wsUrl = `${proto === "https:" ? "wss" : "ws"}://${host}:4000/live?device_id=${encodeURIComponent(deviceId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj && obj.type === "snapshot") {
          setSum((prev) => ({ ...(prev || {}), snapshot: obj, online: true, _serverTs: Date.now() }));
        }
      } catch { /* non-JSON log lines */ }
    };

    return () => { try { ws.close(); } catch {}; wsRef.current = null; };
  }, [deviceId, host, proto]);

  // Accept both shapes (top-level or nested under snapshot)
  const snapshot   = sum?.snapshot || null;
  const osInfo     = snapshot?.os   || sum?.os   || null;
  const ips        = snapshot?.ips  || sum?.ips  || [];
  const runtime    = snapshot?.runtime || sum?.runtime || "";
  const ostree     = snapshot?.ostree_rev || sum?.ostree_rev || "";
  const containers = snapshot?.containers || sum?.containers || [];

  // Online status
  const online = useMemo(() => {
    if (sum?.online) return true;
    const ts = snapshot?._serverTs || sum?._serverTs;
    return ts ? (Date.now() - ts < 20000) : false;
  }, [sum, snapshot]);

  const releaseFromImage = (img) => {
    if (!img) return "—";
    const i = img.lastIndexOf(":");
    return i > 0 ? img.slice(i + 1) : "—";
  };

  const statusClass = (text) => {
    const t = (text || "").toLowerCase();
    if (/(up|running|healthy|created)/.test(t)) return "pill-ok";
    if (/(exit|dead|failed|error)/.test(t))     return "pill-off";
    return "";
  };

  function RebootButton({ deviceId }) {
    const host = window.location.hostname;
    const [busy, setBusy] = React.useState(false);

    async function doReboot() {
      if (!deviceId) return;
      if (!confirm("Reboot this device now?")) return;
      setBusy(true);
      try {
        const r = await fetch(`http://${host}:4000/api/devices/${encodeURIComponent(deviceId)}/reboot`, {
          method: "POST",
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) alert(`Server: ${r.status} ${r.statusText}\n${j?.error || ""}`);
        else alert("Reboot command sent.");
      } catch (e) {
        alert(`Request failed: ${e.message}`);
      } finally {
        setBusy(false);
      }
    }

    return (
      <button onClick={doReboot} disabled={busy} style={{marginLeft:8}}>
        <img src={rebootIconUrl} width={16} height={16} alt="" aria-hidden="true" />
        {busy ? "Rebooting…" : "Reboot"}
      </button>
    );
  }

  return (
    <div className="summary-grid">
      {/* LEFT: Device Summary */}
      <div className="card summary-card">
        <div className="card-header">
          <h3>Device Summary</h3>
          <div className="device-actions" style={{ display: "flex", justifyContent: "flex-end" }}>
            <span className={`pill ${online ? "pill-ok" : "pill-off"}`}>{online ? "Online" : "Offline"}</span>
            <RebootButton deviceId={deviceId} />
          </div>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12}}>
          <div>
            <div style={{fontSize:15, color:"#64748b"}}>FIRMWARE VERSION</div>
            <div style={{marginTop: "6px"}}>{osInfo ? `${osInfo.version}` : "—"}</div>
          </div>
          <div>
            <div style={{fontSize:15, color:"#64748b"}}>KERNEL</div>
            <div style={{display:"inline-flex",background:"#ffe7ef",color:"#6e1a37",borderRadius:"6px",padding:"2px 6px", marginTop: "6px", fontSize:14}} >
              {osInfo?.kernel || "—"}
            </div>
          </div>
          <div>
            <div style={{fontSize:15, color:"#64748b", fontFamily:"monospace"}}>IP ADDRESS</div>
            <div style={{display:"inline-flex",background:"#ffe7ef",color:"#6e1a37",borderRadius:"6px",padding:"2px 6px", marginTop: "6px", fontSize:14}}>
              {ips.length ? ips.map(ip => ip.cidr.split('/')[0]).join(", ") : "—"}
            </div>
          </div>
          <div>
            <div style={{fontSize:15, color:"#64748b"}}>CONTAINER RUNTIME</div>
            <div style={{fontSize:15}}>{runtime || "—"}</div>
          </div>
          <div>
            <div style={{fontSize:15, color:"#64748b"}}>OSTREE REVISION</div>
            <div style={{display:"inline-flex",background:"#ffe7ef",color:"#6e1a37",borderRadius:"6px",padding:"2px 6px", marginTop: "6px", fontSize:14}}>
              {ostree || "—"}
            </div>
          </div>
        </div>

        <div className="card-header" style={{padding:"8px 0 8px 0"}}>
          <strong>Services</strong>
          <span className="hint">{loading ? "loading…" : `${containers.length} running`}</span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Release</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {containers.length ? containers.map((c, i) => (
                <tr key={`${c.id || c.name || i}`}>
                  <td className="mono">{c.name || (c.id ? c.id.slice(0,12) : "—")}</td>
                  <td>
                    <span className={`pill ${statusClass(c.status || c.state)}`}>
                      {c.status || c.state || "—"}
                    </span>
                  </td>
                  <td><span className="mono">{releaseFromImage(c.image)}</span></td>
                  <td className="mono">{c.ports || "—"}</td>
                </tr>
              )) : (
                <tr><td colSpan={4}>No containers reported.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Logs */}
      <div className="card logs-card">
        <div className="card-header">
          <h3>Live logs</h3>
        </div>

        <div className="logs-controls">
          <label style={{fontSize:12, color:"#334155"}}>Device ID</label>
          <span className="pill">{deviceId || "—"}</span>
        </div>

        <LiveLogs />
      </div>

      {/* RIGHT: Terminal */}
      <div className="card term-card">
        <div className="card-header"><h3>Device Terminal</h3></div>
        <div className="term-fields">
          <input placeholder="SSH Host" value={sshHost} onChange={(e)=>setSshHost(e.target.value)} />
          <input placeholder="User" value={sshUser} onChange={(e)=>setSshUser(e.target.value)} />
          <input placeholder="Port" value={sshPort} onChange={(e)=>setSshPort(e.target.value)} />
          <input placeholder="Password (prototype)" type="password" value={sshPass} onChange={(e)=>setSshPass(e.target.value)} />
        </div>
        <div className="term-shell">
          <SshTerminal />
        </div>
      </div>
    </div>
  );
}
