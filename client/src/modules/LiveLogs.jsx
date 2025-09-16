import React, { useEffect, useRef, useState, useMemo } from "react";

function normalizeLevel(obj) {
  if (typeof obj.PRIO === "string") {
    const s = obj.PRIO.toUpperCase();
    if (s.includes("ERR"))   return { label: "ERROR", cls: "sev-error" };
    if (s.includes("WARN"))  return { label: "WARN",  cls: "sev-warn"  };
    if (s.includes("DEBUG")) return { label: "DEBUG", cls: "sev-debug" };
    if (s.includes("INFO"))  return { label: "INFO",  cls: "sev-info"  };
  }
  const p = obj.PRIORITY ?? obj.SYSLOG_PRIORITY;
  const n = Number(p);
  if (!Number.isNaN(n)) {
    const table = [
      ["EMERG","sev-crit"],["ALERT","sev-crit"],["CRIT","sev-crit"],["ERROR","sev-error"],
      ["WARN","sev-warn"],["NOTICE","sev-notice"],["INFO","sev-info"],["DEBUG","sev-debug"],
    ];
    const i = Math.min(7, Math.max(0, n));
    return { label: table[i][0], cls: table[i][1] };
  }
  return { label: "INFO", cls: "sev-info" };
}
function pickUnit(o) {
  // Prefer human-friendly identifier first
  const id = o.SYSLOG_IDENTIFIER || o.COMM || o._COMM;
  if (id) return id;

  // Fall back to unit/slice, but hide generic 'init.scope'
  const unit = o._SYSTEMD_UNIT || o._SYSTEMD_SLICE || o._SYSTEMD_CGROUP;
  if (unit && unit !== "init.scope") return unit;

  return "systemd";
}
function pickTs(o){
  const iso = o.TS || o.__REALTIME_TIMESTAMP || o._SOURCE_REALTIME_TIMESTAMP;
  try {
    if (typeof iso === "string" && iso.includes("T")) return new Date(iso);
    if (iso) return new Date(Number(String(iso).slice(0,13)));
  } catch {}
  return new Date();
}

function parseLine(line) {
  try {
    const o = JSON.parse(line);
    const { label, cls } = normalizeLevel(o);
    // Make sure MESSAGE is a clean single line for the compact view
    const msg = String(o.MESSAGE ?? line).replace(/\s+/g, " ").trim();
    return {
      ts: pickTs(o),
      level: label,
      levelCls: cls,
      unit: pickUnit(o),
      msg,
      raw: line,
    };
  } catch {
    return {
      ts: new Date(),
      level: "INFO",
      levelCls: "sev-info",
      unit: "—",
      msg: line,
      raw: line,
    };
  }
}

export default function LiveLogs({ deviceId }) {
  const [viewerConnected, setViewerConnected] = useState(false);
  const [lastMsgAt, setLastMsgAt] = useState(0);     // when we last received any log
  const [pretty, setPretty] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!deviceId) return;
    const host = window.location.hostname;
    const port = (import.meta.env.VITE_BACKEND_PORT || 4000);
    const ws = new WebSocket(`ws://${host}:${port}/live?device_id=${encodeURIComponent(deviceId)}`);
    wsRef.current = ws;
    ws.onopen = () => setViewerConnected(true);
    ws.onclose = () => { setViewerConnected(false); };
    ws.onmessage = (e) => {
      setItems(prev => {
        const next = [...prev, parseLine(e.data)];
        if (next.length > 2000) next.splice(0, next.length - 2000);
        return next;
      });
      setLastMsgAt(Date.now());
    };
    return () => ws.close();
  }, [deviceId]);

  // keep pinned to bottom if autoScroll enabled
  useEffect(() => {
    if (autoScroll && boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [items, autoScroll]);

  // derive a flow status: streaming (<5s), idle (>=5s), disconnected (viewer WS down)
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setNowTick(x=>x+1), 1000); return () => clearInterval(t); }, []);
  const flowStatus = useMemo(() => {
    if (!viewerConnected) return { txt: "disconnected", cls: "off" };
    if (lastMsgAt && Date.now() - lastMsgAt < 5000) return { txt: "streaming", cls: "on" };
    return { txt: "idle", cls: "idle" };
  }, [viewerConnected, lastMsgAt, nowTick]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      it.raw.toLowerCase().includes(q) ||
      (it.unit && it.unit.toLowerCase().includes(q)) ||
      (it.level && it.level.toLowerCase().includes(q))
    );
  }, [items, filter]);

  return (
    <>
      <div className="log-toolbar">
        <div className="log-toolbar-left">
          <span className={`conn-dot ${flowStatus.cls}`} />
          <span className="conn-text">{flowStatus.txt}</span>
        </div>
        <div className="log-toolbar-right">
          <input className="log-filter" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter (text, level, unit)…" />
          <label className="log-toggle"><input type="checkbox" checked={pretty} onChange={()=>setPretty(!pretty)} /> Pretty</label>
          <label className="log-toggle"><input type="checkbox" checked={autoScroll} onChange={()=>setAutoScroll(!autoScroll)} /> Auto-scroll</label>
        </div>
      </div>

      <div ref={boxRef} className="logs-pane">
        {deviceId ? (
          pretty ? (
            <div className="log-list">
              {visible.map((it, idx) => (
                <div className="log-row" key={idx}>
                  <div className="log-ts">{it.ts.toLocaleString()}</div>
                  <div className={`log-level ${it.levelCls}`}>{it.level}</div>
                  <div className="log-unit">{it.unit}</div>
                  <div className="log-msg">{it.msg}</div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="log-raw">{visible.map(it => it.raw).join("\n")}</pre>
          )
        ) : (
          <div className="log-empty">Enter a Device ID to stream logs.</div>
        )}
      </div>
    </>
  );
}

