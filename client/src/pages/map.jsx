import { useEffect, useRef, useState } from "react";
import api from "../api";

export default function MapPage() {
  const divRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [devices, setDevices] = useState([]);

  // Load Leaflet from CDN once
  async function ensureLeaflet() {
    if (!window.L) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      await new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = resolve;
        document.body.appendChild(s);
      });
    }
    return window.L;
  }

  // Fetch devices (online only)
  const fetchDevices = async () => {
    const r = await api.get("/devices");
    const list = (r.data.devices || []).filter(d => d.online === true);
    console.log("Online devices:", list.map(d => ({ id: d.device_id, geo: d.geo })));
    setDevices(list);
  };

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchDevices().catch(console.warn);
    const t = setInterval(fetchDevices, 30000);
    return () => clearInterval(t);
  }, []);

  // Optional live refresh via WS (skip if dev proxy not ready)
  useEffect(() => {
    let ws;
    try {
      const loc = window.location;
      const wsUrl = `${loc.protocol === "https:" ? "wss" : "ws"}://${loc.host}/live`;
      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log("WS live connected");
      ws.onmessage = (ev) => {
        try {
          const obj = JSON.parse(ev.data);
          if (obj && obj.type === "snapshot") fetchDevices();
        } catch { /* ignore non-JSON lines */ }
      };
      ws.onerror = (e) => console.warn("WS live error (continuing with polling):", e);
    } catch (e) {
      console.warn("WS live connect failed:", e);
    }
    return () => { try { ws && ws.close(); } catch {} };
  }, []);

  // Create map once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await ensureLeaflet();
      if (cancelled || !divRef.current || mapRef.current) return;

      const map = L.map(divRef.current).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
      const lg = L.layerGroup().addTo(map);

      window.__map = map; // debug helper
      mapRef.current = map;
      layerRef.current = lg;
      setTimeout(() => map.invalidateSize(), 50);
    })();
    return () => { cancelled = true; };
  }, []);

  // Render markers for online devices
  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();

    const points = (devices || []).map(d => {
      const g = d.geo || d.snapshot?.geo || null;   // prefer top-level geo
      if (!g) return null;
      const lat = Number(g.lat);
      const lon = Number(g.lon ?? g.lng);           // accept lon or lng
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const label = `${d.name || d.device_id} (${g.source}${g.accuracy_km ? ` ~${g.accuracy_km}km` : ""})`;
      return { lat, lon, label };
    }).filter(Boolean);

    console.log(`Rendering ${points.length} online device(s)`);

    if (points.length === 0) return;

    const bounds = [];
    points.forEach(p => {
      layer.addLayer(L.marker([p.lat, p.lon], { title: p.label }).bindPopup(p.label));
      layer.addLayer(L.circle([p.lat, p.lon], { radius: 5000, color: "#2ecc71", weight: 2, opacity: 1 }));
      bounds.push([p.lat, p.lon]);
    });

    const b = L.latLngBounds(bounds);
    map.fitBounds(b.pad(0.2), { maxZoom: 12 });
  }, [devices]);

  return <div ref={divRef} style={{ height: "100%", minHeight: "80vh", width: "100%" }} />;
}
