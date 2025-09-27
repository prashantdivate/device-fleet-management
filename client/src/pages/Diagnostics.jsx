import React, { useEffect, useRef, useState } from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import "./Diagnostics.css";

/* ----------------- helpers ----------------- */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
function meterColor(pct) {
  if (pct == null) return "#94a3b8";
  if (pct < 60)   return "#16a34a";
  if (pct < 85)   return "#f59e0b";
  return "#dc2626";
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
  if (!Number.isFinite(total_kb)) return null;
  if (!Number.isFinite(used_kb)) return null;
  return clamp(Math.round((used_kb / total_kb) * 100), 0, 100);
}
const fmtPct  = (x) => (x == null ? "—" : `${x}%`);
const fmtMbps = (x) => (x == null || Number.isNaN(x) ? "—" : `${x.toFixed(1)} Mbps`);
const nowMs   = () => Date.now();

/* ----------------- mini charts (SVG) ----------------- */
function Donut({ pct=0, label, sub, size=140, stroke=14, color }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = `${(clamp(pct,0,100) / 100) * c} ${c}`;
  const hue = color || meterColor(pct);
  return (
    <div className="donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E7ECF2" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={hue} strokeWidth={stroke}
                  strokeLinecap="round" strokeDasharray={dash} />
        </g>
        <text x="50%" y="45%" textAnchor="middle" className="donut-val">{fmtPct(pct)}</text>
        <text x="50%" y="63%" textAnchor="middle" className="donut-sub">{label}</text>
      </svg>
      {sub ? <div className="donut-caption">{sub}</div> : null}
    </div>
  );
}

/** Non-progress ring that visually matches donuts, but just shows text (uptime) */
function UptimeBadge({ value, size=140, stroke=14 }) {
  const r = (size - stroke) / 2;
  return (
    <div className="uptime-badge">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size/2} ${size/2})`}>
          {/* only a soft background ring to match donut silhouette */}
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E7ECF2" strokeWidth={stroke} />
        </g>
        <text x="50%" y="42%" textAnchor="middle" className="donut-sub">Uptime</text>
        <text x="50%" y="62%" textAnchor="middle" className="uptime-val">{value}</text>
      </svg>
      <div className="donut-caption">since last boot</div>
    </div>
  );
}

/** LineChart with axes + labels (lightweight) */
function LineChart({
  data = [],
  width = 520,
  height = 140,
  label = "",
  units = "",
  maxY,
  xLeft = "−5m",
  xRight = "now",
}) {
  const vals = data.map(v => (Number.isFinite(v) ? v : 0));
  const ymax = Math.max(1, maxY ?? Math.max(1, ...vals));
  const n = Math.max(2, vals.length || 2);

  const padL = 38, padB = 18, padT = 10, padR = 12;
  const W = width, H = height;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const step = innerW / (n - 1);

  const toXY = (v, i) => {
    const x = padL + i * step;
    const y = padT + (1 - (v / (ymax || 1))) * innerH;
    return [x, y];
  };

  const pts = vals.map(toXY);
  const d = pts.map((p,i)=>`${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${d} L ${padL+innerW},${padT+innerH} L ${padL},${padT+innerH} Z`;

  return (
    <div className="spark">
      {label ? <div className="spark-label">{label}</div> : null}
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", height:H}}>
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT+innerH} stroke="#cbd5e1"/>
        <line x1={padL} y1={padT+innerH} x2={padL+innerW} y2={padT+innerH} stroke="#cbd5e1"/>
        {/* y ticks */}
        <text x={padL-6} y={padT+innerH+10} textAnchor="end" fontSize="10" fill="#64748b">0 {units}</text>
        <text x={padL-6} y={padT+10} textAnchor="end" fontSize="10" fill="#64748b">
          {maxY ? maxY : Math.round(ymax)} {units}
        </text>
        {/* x ticks */}
        <text x={padL} y={H-2} fontSize="10" fill="#64748b">{xLeft}</text>
        <text x={padL+innerW} y={H-2} textAnchor="end" fontSize="10" fill="#64748b">{xRight}</text>

        {/* shaded area + line */}
        {pts.length>1 ? <path d={area} fill="rgba(59,130,246,0.12)" /> : null}
        <path d={d || ""} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ----------- restarts chart (last 48h) ---------- */
/* ----------- restarts chart (last 48h) ---------- */
function RebootChart({ events }) {
  const hours = 48;
  const now = nowMs();
  const start = now - hours * 3600_000;

  // 1 bin per hour
  const bins = new Array(hours).fill(0);
  for (const t of events) {
    if (!Number.isFinite(t) || t < start) continue;
    const hoursAgo = Math.floor((now - t) / 3600_000); // 0..47
    const idx = hours - 1 - hoursAgo;                  // map to [0..47] left→right
    if (idx >= 0 && idx < hours) bins[idx]++;
  }
  const maxv = Math.max(1, ...bins);

  // chart geometry
  const w = 520, h = 160;
  const padL = 44, padB = 24, padT = 12, padR = 12;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const gap = 2;
  const barW = (innerW - (hours - 1) * gap) / hours;

  // ticks: 48h→left, …, now→right
  const tickHours = [48, 36, 24, 12, 0];
  const xForHoursAgo = (hh) => padL + ((hours - hh) / hours) * innerW;
  const tickLabel = (hh) => (hh === 0 ? "now" : `${hh}h ago`);

  return (
    <div className="reboot-wrap">
      <div className="card-header">Device Restart History (last 48h)</div>
      <div className="reboot-sub">Total: <strong>{events.length}</strong></div>

      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: h }}>
        {/* axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#cbd5e1" />
        <line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke="#cbd5e1" />

        {/* y labels */}
        <text x={padL - 6} y={padT + innerH + 10} textAnchor="end" fontSize="10" fill="#64748b">0</text>
        <text x={padL - 6} y={padT + 10} textAnchor="end" fontSize="10" fill="#64748b">{maxv}</text>

        {/* x ticks & labels: 48h ago … now */}
        {tickHours.map((hh, i) => {
          const x = xForHoursAgo(hh);
          return (
            <g key={i}>
              <line x1={x} y1={padT + innerH} x2={x} y2={padT + innerH + 4} stroke="#cbd5e1" />
              <text
                x={x}
                y={h - 5}
                fontSize="10"
                fill="#64748b"
                textAnchor={hh === 0 ? "end" : (hh === 48 ? "start" : "middle")}
              >
                {tickLabel(hh)}
              </text>
            </g>
          );
        })}

        {/* bars with hover tooltips */}
        {bins.map((v, i) => {
          const x = padL + i * (barW + gap);
          const bh = (v / (maxv || 1)) * innerH;
          const y = padT + innerH - bh;
          const hoursAgo = hours - 1 - i; // 0h = current hour
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx="2" ry="2"
              fill="#3b82f6"
              opacity={v ? 0.9 : 0.18}
            >
              <title>{v} reboot{v === 1 ? "" : "s"} · {hoursAgo}h ago</title>
            </rect>
          );
        })}
      </svg>

      <div className="reboot-hint">
        Counts are stored locally; a change in <code>boot_id</code> or an uptime drop registers a reboot.
      </div>
    </div>
  );
}

/* ----------------- main component ----------------- */
export default function Diagnostics() {
  const { deviceId } = useSession();
  const [sum, setSum] = useState(null);
  const [loading, setLoading] = useState(false);

  // time-series
  const [memSeries, setMemSeries] = useState([]);
  const [cpuSeries, setCpuSeries] = useState([]);
  const [rxSeries,  setRxSeries]  = useState([]);
  const [txSeries,  setTxSeries]  = useState([]);

  // restarts tracking (persist)
  const prevUptimeRef = useRef(null);
  const lastBootIdRef  = useRef(null);
  const [rebootEvents, setRebootEvents] = useState([]);
  const LS_EVENTS = deviceId ? `dfm:reboots:${deviceId}` : null;
  const LS_BOOTID = deviceId ? `dfm:lastBootId:${deviceId}` : null;

  const maxPoints = 60; // ~5 min @ 5s

  const host  = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const proto = typeof window !== "undefined" ? window.location.protocol : "http:";
  const apiBase = `${proto}//${host}:4000`;

  // load persisted on mount/device change
  useEffect(() => {
    if (!LS_EVENTS) return;
    try {
      const raw = localStorage.getItem(LS_EVENTS);
      const arr = raw ? JSON.parse(raw) : [];
      setRebootEvents(arr.filter(t => Number.isFinite(t)));
    } catch {}
    try {
      lastBootIdRef.current = localStorage.getItem(LS_BOOTID) || null;
    } catch {}
    // reset series when switching device
    setMemSeries([]); setCpuSeries([]); setRxSeries([]); setTxSeries([]);
    prevUptimeRef.current = null;
  }, [LS_EVENTS, LS_BOOTID, deviceId]);

  useEffect(() => {
    let stop = false;
    if (!deviceId) { setSum(null); return; }

    const fetchOnce = async () => {
      try {
        setLoading(true);
        const r = await fetch(`${apiBase}/api/devices/${encodeURIComponent(deviceId)}/summary`);
        const j = await r.json();
        if (stop) return;
        setSum(j);

        const diag = j?.snapshot?.diag || j?.diag || {};
        const memPct = percent(diag?.mem?.used_kb, diag?.mem?.total_kb);

        const cores = diag?.cpu?.cores ?? diag?.cpu_cores ?? diag?.cores ?? diag?.nproc ?? 1;
        const la1   = Number(diag?.loadavg?.[0] ?? 0);
        const laPct = clamp(Math.round((la1 / (cores || 1)) * 100), 0, 100);

        const rx = Number(diag?.net?.primary?.rx_mbps ?? NaN);
        const tx = Number(diag?.net?.primary?.tx_mbps ?? NaN);

        const push = (setter, val) =>
          setter(prev => {
            const next = [...prev, Number.isFinite(val) ? val : 0];
            if (next.length > maxPoints) next.shift();
            return next;
          });

        if (memPct != null) push(setMemSeries, memPct);
        push(setCpuSeries, laPct);
        push(setRxSeries, rx);
        push(setTxSeries, tx);

        // ----- Robust reboot detection -----
        const currentBoot = j?.snapshot?.boot_id || j?.boot_id || null;
        let countedThisTick = false;

        // 1) boot_id change (works across reloads)
        if (currentBoot) {
          const last = lastBootIdRef.current;
          if (last && currentBoot !== last) {
            setRebootEvents(prev => {
              const now = nowMs();
              const start48 = now - 48 * 3600_000;
              const next = [...prev, now].filter(t => t >= start48);
              try { if (LS_EVENTS) localStorage.setItem(LS_EVENTS, JSON.stringify(next)); } catch {}
              return next;
            });
            countedThisTick = true;
          }
          lastBootIdRef.current = currentBoot;
          try { if (LS_BOOTID) localStorage.setItem(LS_BOOTID, currentBoot); } catch {}
        }

        // 2) uptime drop fallback (avoid double count in same tick)
        const up = Number(diag?.uptime_sec ?? NaN);
        const prev = prevUptimeRef.current;
        if (!countedThisTick && Number.isFinite(up)) {
          if (prev != null && up + 60 < prev) {
            setRebootEvents(prevArr => {
              const now = nowMs();
              const start48 = now - 48 * 3600_000;
              const next = [...prevArr, now].filter(t => t >= start48);
              try { if (LS_EVENTS) localStorage.setItem(LS_EVENTS, JSON.stringify(next)); } catch {}
              return next;
            });
          }
          prevUptimeRef.current = up;
        }
      } catch {
        if (!stop) setSum(null);
      } finally {
        if (!stop) setLoading(false);
      }
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 5000);
    return () => { stop = true; clearInterval(t); };
  }, [deviceId, apiBase, LS_EVENTS, LS_BOOTID]);

  const snapshot = sum?.snapshot || null;
  const diag     = snapshot?.diag || sum?.diag || null;
  const containers = snapshot?.containers || sum?.containers || [];

  // basics
  const memPct   = percent(diag?.mem?.used_kb, diag?.mem?.total_kb);
  const rootDisk = diag?.disk?.root || diag?.disk?.sysroot || null;
  const rootPct  = percent(rootDisk?.used_kb, rootDisk?.total_kb);

  const cores  = diag?.cpu?.cores ?? diag?.cpu_cores ?? diag?.cores ?? diag?.nproc ?? 1;
  const la1    = Number(diag?.loadavg?.[0] ?? 0);
  const la5    = Number(diag?.loadavg?.[1] ?? 0);
  const la15   = Number(diag?.loadavg?.[2] ?? 0);

  const net = diag?.net?.primary || null;

  // --- Dynamic Y-axis for NIC charts ---
  const dynMax = (series, speed) => {
    const sMax = Math.max(0.5, ...series, Number(net?.rx_mbps || 0), Number(net?.tx_mbps || 0));
    const scaled = Math.max(1, Math.ceil(sMax * 1.6));
    return speed ? Math.min(scaled, speed) : scaled;
  };
  const rxMaxY = dynMax(rxSeries, net?.speed_mbps);
  const txMaxY = dynMax(txSeries, net?.speed_mbps);

  const utilRx = (net?.speed_mbps ? clamp((net?.rx_mbps || 0) / net.speed_mbps * 100, 0, 100) : null);
  const utilTx = (net?.speed_mbps ? clamp((net?.tx_mbps || 0) / net.speed_mbps * 100, 0, 100) : null);

  const online = !!sum?.online || (Date.now() - (sum?._serverTs || sum?.snapshot?._serverTs || 0) < 20000);

  return (
    <section className="card fill">
      <div className="page-title">
        <h3>Diagnostics</h3>
        <span className={`pill ${online ? "pill-ok":"pill-off"}`}>{online ? "Online" : "Offline"}</span>
        {/* uptime moved into the System Utilization card as a matching badge */}
      </div>

      {loading && !sum && <div style={{padding:12, color:"#64748b"}}>Loading…</div>}
      {!diag && !loading && <div style={{padding:12, color:"#64748b"}}>Diagnostics not available yet.</div>}

      {diag && (
        <div className="diag-layout diag-2x2">
          {/* 1) System Utilization (top-left) */}
          <div className="card util-card">
            <div className="card-header">System Utilization</div>

            <div className="util-grid util-with-cpu">
              <div className="util-item donutA">
                <Donut
                  pct={memPct ?? 0}
                  label="RAM"
                  sub={`${formatBytesKB(diag?.mem?.used_kb)} / ${formatBytesKB(diag?.mem?.total_kb)}`}
                />
              </div>

              <div className="util-item donutB">
                <Donut
                  pct={rootPct ?? 0}
                  label="RootFS"
                  sub={`${formatBytesKB(rootDisk?.used_kb)} / ${formatBytesKB(rootDisk?.total_kb)}`}
                />
              </div>

              <div className="util-item uptimeTile">
                <UptimeBadge value={secondsToUptime(diag?.uptime_sec)} />
              </div>

              <div className="util-item cpuArea">
                <div className="kpi-label">CPU LOAD</div>
                <div className="kpi-value" style={{marginBottom:4}}>
                  {la1.toFixed(2)} <span className="kpi-sub">(1-min)</span>
                </div>

                {/* <div className="meter-row" title={`1m load ${la1.toFixed(2)} / ${cores} cores`}>
                  <div className="meter-label">1m</div>
                  <div className="meter"><div className="meter-fill" style={{width:`${clamp(Math.round((la1/cores)*100),0,100)}%`, background: meterColor(clamp(Math.round((la1/cores)*100),0,100))}} /></div>
                  <div className="meter-val">{la1.toFixed(2)}</div>
                </div>
                <div className="meter-row" title={`5m load ${la5.toFixed(2)} / ${cores} cores`}>
                  <div className="meter-label">5m</div>
                  <div className="meter"><div className="meter-fill" style={{width:`${clamp(Math.round((la5/cores)*100),0,100)}%`, background: meterColor(clamp(Math.round((la5/cores)*100),0,100))}} /></div>
                  <div className="meter-val">{la5.toFixed(2)}</div>
                </div>
                <div className="meter-row" title={`15m load ${la15.toFixed(2)} / ${cores} cores`}>
                  <div className="meter-label">15m</div>
                  <div className="meter"><div className="meter-fill" style={{width:`${clamp(Math.round((la15/cores)*100),0,100)}%`, background: meterColor(clamp(Math.round((la15/cores)*100),0,100))}} /></div>
                  <div className="meter-val">{la15.toFixed(2)}</div>
                </div>

                <div className="kpi-sub">normalized by <strong>{cores}</strong> core{cores === 1 ? "" : "s"}</div> */}

                {/* PER-CORE UTILIZATION (htop-style) */}
                {/* <div className="core-head">PER-CORE UTILIZATION</div> */}
                {Array.isArray(diag?.cpu?.per_core_pct) && diag.cpu.per_core_pct.length ? (
                  <div className="core-grid">
                    {diag.cpu.per_core_pct.map((v, i) => {
                      const coreNo = i + 1;                               // 1-based numbering
                      const pct = clamp(Math.round(Number(v) || 0), 0, 100);
                      return (
                        <div className="meter-row" key={coreNo} title={`core-${coreNo}: ${pct}%`}>
                          <div className="meter-label">core-{coreNo}</div> {/* <- label */}
                          <div className="meter">
                            <div className="meter-fill" style={{ width: `${pct}%`, background: meterColor(pct) }} />
                          </div>
                          <div className="meter-val">{pct}%</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="kpi-sub">Per-core stats unavailable.</div>
                )}
              </div>
            </div>
          </div>

          {/* 2) Network (top-right) */}
          <div className="card net-card">
            <div className="card-header">Network (primary)</div>
            {net ? (
              <div className="net-grid">
                <div className="net-box">
                  <div className="kpi-label">INTERFACE</div>
                  <div className="kpi-value">
                    {net.iface || "—"}
                    <span className={`pill ${net.link==="up"?"pill-ok":"pill-off"}`} style={{marginLeft:8}}>
                      {net.link || "—"}
                    </span>
                  </div>
                  <div className="kpi-sub">
                    Speed: {net.speed_mbps ? `${net.speed_mbps} Mbps` : "—"} • Duplex: {net.duplex || "—"} • MTU: {net.mtu ?? "—"}
                  </div>
                </div>

                <div className="net-stat">
                  <LineChart data={rxSeries} height={140} width={520} label="RX Mbps (last ~5 min)" units="Mbps" maxY={rxMaxY}/>
                  <div className="bar"><div className="bar-fill" style={{width: utilRx==null?"0%":`${utilRx}%`, background: meterColor(utilRx)}}/></div>
                  <div className="kpi-sub">{fmtMbps(net.rx_mbps)} {net.speed_mbps ? `(of ${net.speed_mbps} Mbps)` : ""}</div>
                </div>

                <div className="net-stat">
                  <LineChart data={txSeries} height={140} width={520} label="TX Mbps (last ~5 min)" units="Mbps" maxY={txMaxY}/>
                  <div className="bar"><div className="bar-fill" style={{width: utilTx==null?"0%":`${utilTx}%`, background: meterColor(utilTx)}}/></div>
                  <div className="kpi-sub">{fmtMbps(net.tx_mbps)} {net.speed_mbps ? `(of ${net.speed_mbps} Mbps)` : ""}</div>
                </div>

                <div className="kpi-sub net-foot">
                  Errors: RX {net.rx_err ?? 0} • TX {net.tx_err ?? 0} &nbsp;|&nbsp;
                  Drops: RX {net.rx_drop ?? 0} • TX {net.tx_drop ?? 0} &nbsp;|&nbsp;
                  Collisions: {net.collisions ?? 0}
                </div>
              </div>
            ) : (
              <div className="kpi-sub" style={{padding:"8px 0"}}>No Ethernet stats detected.</div>
            )}
          </div>

          {/* 3) Services Health (bottom-left) */}
          <div className="card services-card">
            <ServicesHealth diag={diag} containers={containers} />
          </div>

          {/* 4) Restarts chart (bottom-right) */}
          <div className="card reboot-card">
            <RebootChart events={rebootEvents} />
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------- Services health block ------------- */
function ServicesHealth({ diag, containers }) {
  const sysd = diag?.systemd || null;
  const contRunning = (containers || []).filter(c => /running|up|healthy/i.test(c.status || c.state || "")).length;
  const contExited  = (containers || []).filter(c => /exit|dead|failed/i.test(c.status || c.state || "")).length;
  const contCreated = (containers || []).filter(c => /created/i.test(c.status || c.state || "")).length;

  return (
    <>
      <div className="card-header" style={{padding:0, marginBottom:8}}>
        <strong>Services Health</strong>
        <span className="hint" style={{marginLeft:8}}>
          {sysd ? "systemd units" : "containers (fallback)"}
        </span>
      </div>

      {sysd ? (
        <div className="svc-table">
          <Row dot="ok"   label="Active"       value={sysd.counts?.active ?? 0} />
          <Row dot="warn" label="Activating"   value={sysd.counts?.activating ?? 0} />
          <Row dot="grey" label="Inactive"     value={sysd.counts?.inactive ?? 0} />
          <Row dot="bad"  label="Failed"       value={sysd.counts?.failed ?? 0} />
          <Row dot="grey" label="Deactivating" value={sysd.counts?.deactivating ?? 0} />
          <div className="svc-total">Total units: {sysd.total ?? 0}</div>
        </div>
      ) : (
        <div className="svc-table">
          <Row dot="ok"   label="Running"          value={contRunning} />
          <Row dot="warn" label="Created"          value={contCreated} />
          <Row dot="bad"  label="Exited / Failed"  value={contExited} />
          <div className="svc-total">Total containers: {containers.length}</div>
        </div>
      )}
    </>
  );
}

function Row({ dot, label, value }) {
  return (
    <div className="svc-stat-row" title={`${label}: ${value}`}>
      <span className={`svc-dot ${dot}`} />
      <span className="svc-label">{label}</span>
      <span className="svc-count">{value}</span>
    </div>
  );
}
