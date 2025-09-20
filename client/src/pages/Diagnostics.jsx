// client/src/pages/Diagnostics.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import "./Diagnostics.css"

/* ----------------- helpers ----------------- */
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function meterColor(pct) {
  if (pct == null) return "#94a3b8";   // grey / unknown
  if (pct < 60)   return "#16a34a";    // ok
  if (pct < 85)   return "#f59e0b";    // warning
  return "#dc2626";                    // critical
}

function formatBytesKB(kb) {
  if (kb == null) return "—";
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function secondsToUptime(sec) {
  if (sec == null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function percent(used_kb, total_kb) {
  if (!total_kb && total_kb !== 0) return null;
  if (used_kb == null) return null;
  return clamp(Math.round((used_kb / total_kb) * 100), 0, 100);
}

/** Pick a disk object for a given role from flexible shapes.
 * Supports:
 *  - diag.disk                 -> assumed ROOT
 *  - diag.app_disk             -> APP
 *  - diag.disks (array/map)    -> find by key or by mount path
 */
function pickDisk(diag, role /* 'root' | 'app' */, fallbackMounts = []) {
  if (!diag) return null;

  // explicit fields
  if (role === "root" && diag.disk) return diag.disk;
  if (role === "app"  && diag.app_disk) return diag.app_disk;

  const disks = diag.disks;
  if (!disks) return null;

  // normalize to array of {name?, mount?, used_kb, total_kb}
  let arr = [];
  if (Array.isArray(disks)) {
    arr = disks;
  } else if (typeof disks === "object") {
    for (const [k, v] of Object.entries(disks)) {
      arr.push({ name: k, ...(v || {}) });
    }
  }

  // role-based matching
  const namesWanted = role === "root" ? ["root", "os", "system", "/"] : ["app", "apps", "application", "data"];
  const mountsWanted = role === "root"
    ? ["/", "/root", "/sysroot", "/ostree/deploy", "/usr"]
    : [...fallbackMounts, "/app", "/mnt/app", "/data", "/mnt/data", "/var/lib/containers", "/var/lib/docker"];

  // 1) exact name match
  let hit = arr.find(d => namesWanted.some(n => (d.name || "").toLowerCase() === n));
  if (hit) return hit;

  // 2) mount path fuzzy
  hit = arr.find(d => mountsWanted.some(m => (d.mount || "").startsWith(m)));
  if (hit) return hit;

  // 3) heuristic fallback:
  //    - for root: largest total_kb
  //    - for app : second largest total_kb
  const bySize = [...arr].filter(d => d.total_kb).sort((a, b) => (b.total_kb || 0) - (a.total_kb || 0));
  if (bySize.length) {
    if (role === "root") return bySize[0];
    if (role === "app")  return bySize[1] || null;
  }
  return null;
}

function lastSeenFromSummary(sum) {
  const ts = sum?.snapshot?._serverTs || sum?._serverTs || sum?.snapshot?.ts;
  if (!ts) return null;
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff/1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  return `${h}h ago`;
}

/* ----------------- component ----------------- */
export default function Diagnostics() {
  const { deviceId } = useSession();
  const [sum, setSum] = useState(null);
  const [loading, setLoading] = useState(false);

  const host  = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const proto = typeof window !== "undefined" ? window.location.protocol : "http:";
  const apiBase = `${proto}//${host}:4000`;

  useEffect(() => {
    let stop = false;
    if (!deviceId) { setSum(null); return; }

    const fetchOnce = async () => {
      try {
        setLoading(true);
        const r = await fetch(`${apiBase}/api/devices/${encodeURIComponent(deviceId)}/summary`);
        const j = await r.json();
        if (!stop) setSum(j);
      } catch {
        if (!stop) setSum(null);
      } finally {
        if (!stop) setLoading(false);
      }
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [deviceId, apiBase]);

  const snapshot   = sum?.snapshot || null;
  const diag       = snapshot?.diag || sum?.diag || null;
  const containers = snapshot?.containers || sum?.containers || [];

  // systemd (preferred) and container fallback
  const sysd = diag?.systemd || null;
  const contRunning = containers.filter(c => /running|up|healthy/i.test(c.status || c.state || "")).length;
  const contExited  = containers.filter(c => /exit|dead|failed/i.test(c.status || c.state || "")).length;
  const contCreated = containers.filter(c => /created/i.test(c.status || c.state || "")).length;

  // memory %
  const memPct = percent(diag?.mem?.used_kb, diag?.mem?.total_kb);

  // disk ROOT & APP (supports multiple shapes, see pickDisk)
  const rootDisk = pickDisk(diag, "root");
  const appDisk  = pickDisk(diag, "app");
  const rootPct  = percent(rootDisk?.used_kb, rootDisk?.total_kb);
  const appPct   = percent(appDisk?.used_kb,  appDisk?.total_kb);

  // CPU load normalized by core count
  const cores = diag?.cpu?.cores ?? diag?.cpu_cores ?? diag?.cores ?? diag?.nproc ?? 1;
  const la1  = Number(diag?.loadavg?.[0] ?? 0);
  const la5  = Number(diag?.loadavg?.[1] ?? 0);
  const la15 = Number(diag?.loadavg?.[2] ?? 0);
  const la1Pct  = clamp(Math.round((la1  / cores) * 100), 0, 100);
  const la5Pct  = clamp(Math.round((la5  / cores) * 100), 0, 100);
  const la15Pct = clamp(Math.round((la15 / cores) * 100), 0, 100);

  const online = !!sum?.online || (Date.now() - (sum?._serverTs || sum?.snapshot?._serverTs || 0) < 20000);
  const lastUpdate = lastSeenFromSummary(sum);
  const lastUpdateTitle = sum?.snapshot?.ts || sum?._serverTs ? new Date(sum?.snapshot?._serverTs || sum?._serverTs || sum?.snapshot?.ts).toString() : "";

  return (
    <section className="card fill">
      <div className="card-header">
        <h3 style={{margin:0}}>Diagnostics</h3>
        <span className={`pill ${online ? "pill-ok":"pill-off"}`} title={lastUpdateTitle}>
          {online ? "Online" : "Offline"}
        </span>
      </div>

      {loading && !sum && <div style={{padding:12, color:"#64748b"}}>Loading…</div>}
      {!diag && !loading && (
        <div style={{padding:12, color:"#64748b"}}>
          Diagnostics not available yet.
        </div>
      )}

      {diag && (
        <div className="diag-grid">
          {/* KPIs */}
          <div className="diag-kpis">
            {/* Uptime */}
            <div className="kpi" title={`Uptime: ${secondsToUptime(diag.uptime_sec)} (updated ${lastUpdate || "—"})`}>
              <div className="kpi-label">Uptime</div>
              <div className="kpi-value">{secondsToUptime(diag.uptime_sec)}</div>
              <div className="kpi-sub">since last boot</div>
            </div>

            {/* CPU Load (normalized by core count) */}
            <div className="kpi" title={`Cores: ${cores} • 1m: ${la1.toFixed(2)}, 5m: ${la5.toFixed(2)}, 15m: ${la15.toFixed(2)}`}>
              <div className="kpi-label">CPU Load</div>
              <div className="kpi-value">
                {la1.toFixed(2)} <span className="kpi-sub">(1-min)</span>
              </div>

              <div className="meter-row" title={`1m load ${la1.toFixed(2)} / ${cores} cores → ${la1Pct}%`}>
                <div className="meter-label">1m</div>
                <div className="meter"><div className="meter-fill" style={{width:`${la1Pct}%`, background: meterColor(la1Pct)}} /></div>
                <div className="meter-val">{la1.toFixed(2)}</div>
              </div>

              <div className="meter-row" title={`5m load ${la5.toFixed(2)} / ${cores} cores → ${la5Pct}%`}>
                <div className="meter-label">5m</div>
                <div className="meter"><div className="meter-fill" style={{width:`${la5Pct}%`, background: meterColor(la5Pct)}} /></div>
                <div className="meter-val">{la5.toFixed(2)}</div>
              </div>

              <div className="meter-row" title={`15m load ${la15.toFixed(2)} / ${cores} cores → ${la15Pct}%`}>
                <div className="meter-label">15m</div>
                <div className="meter"><div className="meter-fill" style={{width:`${la15Pct}%`, background: meterColor(la15Pct)}} /></div>
                <div className="meter-val">{la15.toFixed(2)}</div>
              </div>

              <div className="kpi-sub">normalized by <strong>{cores}</strong> core{cores === 1 ? "" : "s"}</div>
            </div>

            {/* Memory */}
            <div
              className="kpi"
              title={`Memory: ${formatBytesKB(diag.mem?.used_kb)} / ${formatBytesKB(diag.mem?.total_kb)}${memPct != null ? ` (${memPct}%)` : ""}`}
            >
              <div className="kpi-label">Memory</div>
              <div className="meter meter-lg">
                <div className="meter-fill" style={{width: memPct == null ? "0%" : `${memPct}%`, background: meterColor(memPct)}} />
              </div>
              <div className="kpi-sub">
                {formatBytesKB(diag.mem?.used_kb)} / {formatBytesKB(diag.mem?.total_kb)}
                {memPct != null ? ` (${memPct}%)` : ""} &nbsp;•&nbsp; updated {lastUpdate || "—"}
              </div>
            </div>

            {/* Disk (ROOT) */}
            <div
              className="kpi"
              title={`Root: ${formatBytesKB(rootDisk?.used_kb)} / ${formatBytesKB(rootDisk?.total_kb)}${rootPct != null ? ` (${rootPct}%)` : ""}${rootDisk?.mount ? ` • ${rootDisk.mount}` : ""}`}
            >
              <div className="kpi-label">Disk (root)</div>
              <div className="meter meter-lg">
                <div className="meter-fill" style={{width: rootPct == null ? "0%" : `${rootPct}%`, background: meterColor(rootPct)}} />
              </div>
              <div className="kpi-sub">
                {formatBytesKB(rootDisk?.used_kb)} / {formatBytesKB(rootDisk?.total_kb)}
                {rootPct != null ? ` (${rootPct}%)` : ""} {rootDisk?.mount ? ` • ${rootDisk.mount}` : ""}
              </div>
            </div>

            {/* Disk (APP) — only shows if discoverable */}
            {appDisk ? (
              <div
                className="kpi"
                title={`App: ${formatBytesKB(appDisk?.used_kb)} / ${formatBytesKB(appDisk?.total_kb)}${appPct != null ? ` (${appPct}%)` : ""}${appDisk?.mount ? ` • ${appDisk.mount}` : ""}`}
              >
                <div className="kpi-label">Disk (app)</div>
                <div className="meter meter-lg">
                  <div className="meter-fill" style={{width: appPct == null ? "0%" : `${appPct}%`, background: meterColor(appPct)}} />
                </div>
                <div className="kpi-sub">
                  {formatBytesKB(appDisk?.used_kb)} / {formatBytesKB(appDisk?.total_kb)}
                  {appPct != null ? ` (${appPct}%)` : ""} {appDisk?.mount ? ` • ${appDisk.mount}` : ""}
                </div>
              </div>
            ) : null}

            {/* CPU Temp */}
            <div
              className="kpi"
              title={diag?.cpu_temp_c != null ? `CPU temp: ${diag.cpu_temp_c.toFixed(1)}°C` : "CPU temp: —"}
            >
              <div className="kpi-label">CPU Temp</div>
              <div className="kpi-value">
                {diag?.cpu_temp_c != null ? `${diag.cpu_temp_c.toFixed(1)}°C` : "—"}
              </div>
              <div className="meter">
                {(() => {
                  const c = diag?.cpu_temp_c;
                  let pct = null;
                  if (c != null) pct = clamp(Math.round((c / 90) * 100), 0, 100); // scale 0–90°C
                  return <div className="meter-fill" style={{width: pct == null ? "0%" : `${pct}%`, background: meterColor(pct)}} />;
                })()}
              </div>
              <div className="kpi-sub">approximate</div>
            </div>
          </div>

          {/* Services health: systemd preferred, container fallback */}
          <div className="diag-services card">
            <div className="card-header" style={{padding:0, marginBottom:8}}>
              <strong>Services Health</strong>
              <span className="hint" style={{marginLeft:8}} title={lastUpdateTitle}>
                {sysd ? "systemd units" : "containers (fallback)"} • updated {lastUpdate || "—"}
              </span>
            </div>

            {sysd ? (
              <>
                <Row dot="ok"   label="Active"       value={sysd.counts?.active ?? 0} />
                <Row dot="warn" label="Activating"   value={sysd.counts?.activating ?? 0} />
                <Row dot="grey" label="Inactive"     value={sysd.counts?.inactive ?? 0} />
                <Row dot="bad"  label="Failed"       value={sysd.counts?.failed ?? 0} />
                <Row dot="grey" label="Deactivating" value={sysd.counts?.deactivating ?? 0} />
                <div className="svc-total">Total units: {sysd.total ?? 0}</div>

                {sysd.failed && sysd.failed.length > 0 && (
                  <div style={{marginTop:10}}>
                    <div className="kpi-label" style={{marginBottom:6}}>Failed units (top)</div>
                    <ul className="failed-list">
                      {sysd.failed.map(u => (
                        <li key={u.unit}>
                          <code>{u.unit}</code>
                          {u.description ? <span className="failed-desc"> — {u.description}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                <Row dot="ok"   label="Running"          value={contRunning} />
                <Row dot="warn" label="Created"          value={contCreated} />
                <Row dot="bad"  label="Exited / Failed"  value={contExited} />
                <div className="svc-total">Total containers: {containers.length}</div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* small sub-components */
function Row({ dot, label, value }) {
  return (
    <div className="svc-stat-row" title={`${label}: ${value}`}>
      <span className={`svc-dot ${dot}`} />
      <span className="svc-label">{label}</span>
      <span className="svc-count">{value}</span>
    </div>
  );
}
