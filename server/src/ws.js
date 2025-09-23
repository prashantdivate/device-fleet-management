// server/src/ws.js
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import { loadCustomLocations, saveCustomLocations } from "./store.js";

// If your Node < 18, uncomment the next 2 lines:
// import fetchPkg from "node-fetch";
// const fetch = globalThis.fetch || fetchPkg;

/**
 * Lightweight IP → geo via ip-api.com (city-level, rate-limited).
 * Returns: { lat, lon, accuracy_km, city?, country?, _provider }
 */
async function geoFromIp(ip) {
  if (!ip) return null;
  // ignore private/link-local ranges
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(ip)) return null;

  const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,lat,lon,city,country`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (j.status !== "success") return null;
    return { lat: j.lat, lon: j.lon, accuracy_km: 25, city: j.city, country: j.country, _provider: "ip-api" };
  } catch {
    return null;
  }
}

/**
 * WS hub:
 * - /ingest  : device agents send JSON lines (+ periodic {type:'snapshot'})
 * - /live    : browsers subscribe to live logs (optionally per device)
 * Keeps small in-memory state per device and writes raw logs to disk.
 */

const LOG_ROOT = path.join(process.cwd(), "logs");
fs.mkdirSync(LOG_ROOT, { recursive: true });

// deviceId -> state
// state = {
//   device_id, name, online,
//   auto_geo?, device_geo?, custom_geo?,
//   snapshot?, os?, ips?, containers?, runtime?,
//   _serverTs
// }
const deviceState = new Map();
const customLoc = loadCustomLocations();

// viewers
// deviceId -> Set<WebSocket> (receives only that device's lines)
const viewers = new Map();
// global viewers (receive all lines)
const globalViewers = new Set();

function extractIp(req) {
  let ip = req.socket?.remoteAddress || "";
  // If behind a trusted proxy, honor X-Forwarded-For
  if (process.env.TRUST_PROXY === "1") {
    const xff = req.headers["x-forwarded-for"];
    if (xff) ip = String(xff).split(",")[0].trim();
  }
  // normalize IPv6-mapped IPv4 (::ffff:1.2.3.4)
  const m = ip && ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) ip = m[1];
  return ip;
}

function ensureState(device_id) {
  if (!deviceState.has(device_id)) {
    deviceState.set(device_id, { device_id, online: false, _serverTs: Date.now() });
  }
  const st = deviceState.get(device_id);
  const c = customLoc[device_id];
  st.custom_geo = c ? { lat: c.lat, lon: c.lon, label: c.label, source: "custom" } : undefined;
  return st;
}

function computeGeo(st) {
  // priority: custom > device > auto
  return st.custom_geo || st.device_geo || st.auto_geo || null;
}

function writeLogLine(device_id, text) {
  const f = path.join(LOG_ROOT, `${device_id}.jsonl`);
  fs.appendFile(f, text + "\n", () => {});
}

// ---------- Public API used by REST layer ----------
export function listDevices() {
  const out = [];
  for (const st of deviceState.values()) {
    out.push({
      device_id: st.device_id,
      name: st.name || st.device_id,
      online: !!st.online,
      geo: computeGeo(st),
      os: st.os,
      ips: st.ips,
      runtime: st.runtime,
      containers: st.containers,
      snapshot: st.snapshot,
      _serverTs: st._serverTs,
      control: st.control || { enabled: false },
    });
  }
  out.sort((a, b) => Number(b.online) - Number(a.online));
  return out;
}

export function getDeviceSummary(id) {
  const st = deviceState.get(id);
  if (!st) return { error: "not_found" };
  return {
    device_id: st.device_id,
    name: st.name || st.device_id,
    online: !!st.online,
    geo: computeGeo(st),
    os: st.os,
    ips: st.ips,
    runtime: st.runtime,
    containers: st.containers,
    snapshot: st.snapshot,
    _serverTs: st._serverTs,
    control: st.control || { enabled: false },
  };
}

export function setCustomLocation(device_id, { lat, lon, label }) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("invalid lat/lon");
  customLoc[device_id] = { lat, lon, label, updatedAt: new Date().toISOString() };
  saveCustomLocations(customLoc);
  const st = ensureState(device_id);
  st.custom_geo = { lat, lon, label, source: "custom" };
  st._serverTs = Date.now();
  return computeGeo(st);
}

export function unsetCustomLocation(device_id) {
  delete customLoc[device_id];
  saveCustomLocations(customLoc);
  const st = ensureState(device_id);
  st.custom_geo = undefined;
  st._serverTs = Date.now();
  return computeGeo(st);
}

// ---------- WebSocket setup ----------
export function setupWs(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== "/ingest" && pathname !== "/live") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, pathname);
    });
  });

  wss.on("connection", async (ws, req, pathname) => {
    if (pathname === "/live") {
      // Viewer connections: optional ?device_id=abc to filter
      const url = new URL(req.url, `http://${req.headers.host}`);
      const deviceId = url.searchParams.get("device_id");

      if (deviceId) {
        if (!viewers.has(deviceId)) viewers.set(deviceId, new Set());
        viewers.get(deviceId).add(ws);
        ws.on("close", () => {
          const set = viewers.get(deviceId);
          if (set) set.delete(ws);
        });
      } else {
        globalViewers.add(ws);
        ws.on("close", () => globalViewers.delete(ws));
      }
      return;
    }

    if (pathname === "/ingest") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const deviceId = url.searchParams.get("device_id") || "unknown";
      const st = ensureState(deviceId);
      st.online = true;
      st._serverTs = Date.now();

      // Best-effort: geolocate the socket/forwarded IP on connect
      (async () => {
        const ip = extractIp(req);
        const auto = await geoFromIp(ip);
        if (auto) {
          st.auto_geo = { lat: auto.lat, lon: auto.lon, accuracy_km: auto.accuracy_km, ip, source: "ip" };
          st._serverTs = Date.now();
        }
      })().catch(() => {});

      ws.on("message", (buf) => {
        const text = buf.toString("utf8").trim();
        if (!text) return;

        // Persist raw line
        writeLogLine(deviceId, text);

        // Try to parse JSON
        let obj = null;
        try {
          obj = JSON.parse(text);
        } catch {
          /* non-JSON log line; still relay */
        }

        if (obj && typeof obj === "object") {
          // HELLO (once per connect)
          if (obj.type === "hello") {
            st.name = obj.name || deviceId;
            st.control = { enabled: !!obj.allow_control };
            st._serverTs = Date.now();
          }

          // SNAPSHOT (periodic)
          if (obj.type === "snapshot") {
            st.snapshot = obj;
            st.os = obj.os;
            st.ips = obj.ips;
            st.runtime = obj.runtime;
            st.containers = obj.containers;

            // If agent provided a public IPv4, geolocate it (works even on LAN)
            if (obj.public_ip) {
              (async () => {
                const auto = await geoFromIp(obj.public_ip);
                if (auto) {
                  st.auto_geo = {
                    lat: auto.lat,
                    lon: auto.lon,
                    accuracy_km: auto.accuracy_km,
                    ip: obj.public_ip,
                    source: "ip",
                  };
                  st._serverTs = Date.now();
                }
              })().catch(() => {});
            }

            // If the agent ever adds precise coordinates (GNSS/Wi-Fi), honor them:
            // obj.geo = { lat, lon, accuracy_m?, source? }
            if (obj.geo && Number.isFinite(obj.geo.lat) && Number.isFinite(obj.geo.lon)) {
              st.device_geo = { ...obj.geo, source: obj.geo.source || "device" };
              st._serverTs = Date.now();
            }
          }
        }

        // Fan out to device-specific viewers
        const set = viewers.get(deviceId);
        if (set) {
          for (const v of set) {
            if (v.readyState === v.OPEN) v.send(text);
          }
        }
        // And to global viewers
        for (const v of globalViewers) {
          if (v.readyState === v.OPEN) v.send(text);
        }
      });

      ws.on("close", () => {
        const st = ensureState(deviceId);
        st.online = false;              // keep last snapshot & geo for UI
        st._serverTs = Date.now();
      });
    }
  });
}
