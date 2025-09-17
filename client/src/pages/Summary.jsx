import React, { useEffect, useMemo, useRef, useState } from "react";
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
        if (!stop) setSum((prev) => prev || null); // don't nuke a good WS snapshot
      } finally {
        if (!stop) setLoading(false);
      }
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [deviceId, apiBase]);

  // WS fallback: listen for {type:"snapshot"} on /live and update immediately
  useEffect(() => {
    if (!deviceId) return;
    // close any previous
    try { wsRef.current?.close(); } catch {}
    const wsUrl = `${proto === "https:" ? "wss" : "ws"}://${host}:4000/live?device_id=${encodeURIComponent(deviceId)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const obj = JSON.parse(ev.data);
        if (obj && obj.type === "snapshot") {
          setSum((prev) => {
            // keep server fields if present; store the latest snapshot
            const merged = { ...(prev || {}), snapshot: obj, online: true, _serverTs: Date.now() };
            return merged;
          });
        }
      } catch {
        /* ignore non-JSON log lines */
      }
    };
    ws.onclose = () => { /* noop */ };
    ws.onerror = () => { /* noop */ };

    return () => {
      try { ws.close(); } catch {}
      wsRef.current = null;
    };
  }, [deviceId, host, proto]);

  // Accept both shapes (top-level or nested under snapshot)
  const snapshot   = sum?.snapshot || null;
  const osInfo     = snapshot?.os   || sum?.os   || null;
  const ips        = snapshot?.ips  || sum?.ips  || [];
  const runtime    = snapshot?.runtime || sum?.runtime || "";
  const containers = snapshot?.containers || sum?.containers || [];

  // “Online” if summary says so, or if a snapshot arrived recently
  const online = useMemo(() => {
    if (sum?.online) return true;
    const ts = snapshot?._serverTs || sum?._serverTs;
    return ts ? (Date.now() - ts < 20000) : false;
  }, [sum, snapshot]);

  const releaseFromImage = (img) => {
    if (!img) return "—";
    const i = img.lastIndexOf(":");
    return i > 0 ? img.slice(i + 1) : "—";
    // (you can swap to digest parsing if you prefer)
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
          <div>
            {/* your Online/Offline pill here */}
            <RebootButton deviceId={deviceId} />
          </div>
          <span className={`pill ${online ? "pill-ok" : "pill-off"}`}>{online ? "Online" : "Offline"}</span>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12}}>
          <div>
            <div style={{fontSize:12, color:"#64748b"}}>OS</div>
            <div>{osInfo ? `${osInfo.name || ""}${osInfo.version ? " " + osInfo.version : ""}` : "—"}</div>
          </div>
          <div>
            <div style={{fontSize:12, color:"#64748b"}}>Kernel</div>
            <div>{osInfo?.kernel || "—"}</div>
          </div>
          <div>
            <div style={{fontSize:12, color:"#64748b"}}>IP Address</div>
            <div>{ips.length ? ips.map(ip => `${ip.if}: ${ip.cidr}`).join(", ") : "—"}</div>
          </div>
          <div>
            <div style={{fontSize:12, color:"#64748b"}}>Container Runtime</div>
            <div>{runtime || "—"}</div>
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

      {/* RIGHT: Logs (UNCHANGED) */}
      <div className="card logs-card">
        <div className="card-header">
          <h3>Logs</h3>
          <span className="pill">{deviceId || "—"}</span>
        </div>

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

      {/* RIGHT: Terminal (UNCHANGED) */}
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
