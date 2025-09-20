import React, { useEffect, useMemo, useRef, useState } from "react";
import "./update.css";

const api = (p) => `/api/hb${p}`;

export default function Updates() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const [dsets, setDsets] = useState([]);
  const [targets, setTargets] = useState([]);
  const [dsId, setDsId] = useState("");
  const [targetId, setTargetId] = useState("");

  const [logs, setLogs] = useState([
    "[INFO] OTA panel ready. Click Reconnect, then Refresh Lists.",
  ]);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef(null);
  const lastActionIdRef = useRef(null);

  const log = (line) =>
    setLogs((prev) => [...prev, line].slice(-600)); // keep last ~600 lines

  // ---- API helpers ----
  async function getJSON(path) {
    const r = await fetch(api(path));
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }
  async function postJSON(path, body) {
    const r = await fetch(api(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`${r.status} ${r.statusText}: ${text}`);
    }
    return r.headers.get("content-length") === "0" ? null : r.json();
  }

  // ---- Actions ----
  const connect = async () => {
    try {
      const r = await getJSON("/ping");
      if (r?.ok) {
        setConnected(true);
        log(`[INFO] Connected to ${r.base} (tenant=${r.tenant}).`);
      } else {
        setConnected(false);
        log("[ERR ] Ping failed.");
      }
    } catch (e) {
      setConnected(false);
      log(`[ERR ] Ping error: ${e.message}`);
    }
  };

  const refreshLists = async () => {
    setLoading(true);
    try {
      const [ds, tg] = await Promise.all([
        getJSON("/distributions"),
        getJSON("/targets"),
      ]);
      setDsets(ds || []);
      setTargets(tg || []);
      setDsId(ds?.[0]?.id?.toString() || "");
      setTargetId(tg?.[0]?.id?.toString() || "");
      log(
        `[INFO] Loaded ${ds?.length || 0} distributions and ${tg?.length || 0} targets.`
      );
    } catch (e) {
      log(`[ERR ] Refresh failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!dsId || !targetId) return;
    try {
      log(`[INFO] Assigning DS id=${dsId} → target id=${targetId}…`);
      await postJSON("/publish", { dsId, targetId });
      log("[INFO] Assignment requested. Starting progress polling…");
      startPolling();
    } catch (e) {
      log(`[ERR ] Publish failed: ${e.message}`);
    }
  };

  const startPolling = () => {
    stopPolling();
    setPolling(true);
    pollTimerRef.current = setInterval(async () => {
      try {
        if (!targetId) return;
        const latest = await getJSON(
          `/targets/${encodeURIComponent(targetId)}/actions/latest`
        );
        if (!latest) {
          log("[WARN] No actions found for target yet.");
          return;
        }
        const actionId = latest.id ?? latest.actionId;
        if (lastActionIdRef.current !== actionId) {
          lastActionIdRef.current = actionId;
          log(`[INFO] Tracking action id=${actionId}`);
        }

        let detail;
        try {
          detail = await getJSON(
            `/targets/${encodeURIComponent(targetId)}/actions/${encodeURIComponent(
              actionId
            )}`
          );
        } catch {
          detail = latest;
        }

        const statusObj = detail?.status;
        const statusDict = typeof statusObj === "object" ? statusObj : {};
        const statusStr = typeof statusObj === "string" ? statusObj : undefined;

        const execution =
          statusDict?.execution ||
          statusStr ||
          detail?.execution ||
          detail?.state ||
          detail?.actionStatus ||
          "unknown";

        const result =
          statusDict?.result && typeof statusDict.result === "object"
            ? statusDict.result
            : {};
        const finished = result?.finished;
        const code = statusDict?.code;
        const details = statusDict?.details;

        let line = `[ACTION ${actionId}] execution=${execution}`;
        if (finished) line += `, finished=${finished}`;
        if (code !== undefined) line += `, code=${code}`;
        if (details) {
          const dshort = Array.isArray(details)
            ? details.slice(0, 3).join("; ")
            : String(details);
          line += `, details=${dshort}`;
        }
        log(line);

        const ex = String(execution).toLowerCase();
        if (
          ["closed", "finished", "success", "failed", "canceled", "cancelled"].includes(
            ex
          )
        ) {
          log("[INFO] Action appears terminal. Stopping polling.");
          stopPolling();
        }
      } catch (e) {
        log(`[ERR ] Poll error: ${e.message}`);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setPolling(false);
  };

  useEffect(() => {
    // optional: auto-connect
    connect();
    return () => stopPolling();
  }, []);

  const canPublish = useMemo(
    () => !!dsId && !!targetId && connected && !loading,
    [dsId, targetId, connected, loading]
  );

  return (
    <section className="card fill">
      <div className="card-header updates-header">
        <h3>Updates</h3>
        <span
          className={`updates-badge ${connected ? "ok" : "bad"}`}
          title={connected ? "Connected" : "Disconnected"}
        >
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      <div className="updates-body">
        {/* Controls */}
        <div className={`nav-card updates-card ${connected ? "is-active" : ""}`}>
          <div className="nav-inner">
            <div className="updates-form">
              <div className="updates-field">
                <label>Distribution Set</label>
                <select
                  className="updates-select"
                  value={dsId}
                  onChange={(e) => setDsId(e.target.value)}
                >
                  {dsets.map((d) => (
                    <option key={String(d.id)} value={String(d.id)}>
                      {d.name}:{d.version} (id={d.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="updates-field">
                <label>Target Device</label>
                <select
                  className="updates-select"
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                >
                  {targets.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {t.name} / {t.controllerId} (id={t.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="updates-actions-main">
                <button
                  className={`btn ${canPublish ? "btn-primary" : "btn-disabled"}`}
                  onClick={publish}
                  disabled={!canPublish}
                >
                  Publish (Assign)
                </button>
                <button
                  className={`btn ${loading ? "btn-disabled" : "btn-dark"}`}
                  onClick={refreshLists}
                  disabled={loading}
                >
                  Refresh Lists
                </button>
                <button
                  className={`btn ${polling ? "btn-warn" : "btn-muted"}`}
                  onClick={polling ? stopPolling : startPolling}
                  disabled={!targetId}
                >
                  {polling ? "Stop Polling" : "Start Polling"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="updates-logs-wrap">
          <label>Progress & Logs</label>
          <div className="updates-logs">
            {logs.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="updates-actions">
          <button className="btn btn-outline" onClick={connect}>
            Reconnect
          </button>
          <button className="btn btn-outline" onClick={() => setLogs([])}>
            Clear Logs
          </button>
        </div>
      </div>
    </section>
  );
}
