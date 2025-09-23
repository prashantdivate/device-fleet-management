// server/src/geo.js
// Resolves public IP to approx {lat, lon, accuracy_km?, city?, country?}
// Caches results in memory + optional file cache.

import fs from "fs";
import path from "path";

const GEO_FILE = path.join(process.cwd(), "data", "ip-cache.json");
let mem = {};
try { mem = JSON.parse(fs.readFileSync(GEO_FILE, "utf8")); } catch { mem = {}; }

function persist() {
  fs.mkdirSync(path.dirname(GEO_FILE), { recursive: true });
  fs.writeFileSync(GEO_FILE, JSON.stringify(mem, null, 2));
}

function now() { return Math.floor(Date.now() / 1000); }

// Simple TTL (default 7 days)
const TTL_SEC = Number(process.env.GEO_CACHE_TTL_SEC || 7 * 24 * 3600);

// Provider: ip-api.com (no key; reasonable for prototypes)
// You can switch to ipinfo (set GEO_PROVIDER=ipinfo + GEO_IPINFO_TOKEN) if you want.
async function queryIpApi(ip) {
  const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,lat,lon,city,country`);
  const j = await r.json();
  if (j.status !== "success") throw new Error(j.message || "ip-api failure");
  return { lat: j.lat, lon: j.lon, city: j.city, country: j.country, accuracy_km: 25, _provider: "ip-api" };
}

async function queryIpInfo(ip, token) {
  const r = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}?token=${token}`);
  const j = await r.json();
  // ipinfo returns "loc": "lat,lon"
  const [latStr, lonStr] = (j.loc || "").split(",");
  const lat = Number(latStr), lon = Number(lonStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("ipinfo missing loc");
  return { lat, lon, city: j.city, country: j.country, accuracy_km: 20, _provider: "ipinfo" };
}

export async function geoFromIp(ip) {
  if (!ip) return null;
  // Normalize IPv6-mapped IPv4: ::ffff:1.2.3.4
  const m = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) ip = m[1];
  // Ignore RFC1918 & link-local, return null (no public location)
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(ip)) return null;
  // cache
  const entry = mem[ip];
  if (entry && (now() - entry.ts) < TTL_SEC) return entry.data;

  let data = null;
  const provider = (process.env.GEO_PROVIDER || "ip-api").toLowerCase();
  try {
    if (provider === "ipinfo" && process.env.GEO_IPINFO_TOKEN) {
      data = await queryIpInfo(ip, process.env.GEO_IPINFO_TOKEN);
    } else {
      data = await queryIpApi(ip);
    }
  } catch (e) {
    // soft-fail, don't throw
    return null;
  }
  mem[ip] = { ts: now(), data };
  persist();
  return data;
}
