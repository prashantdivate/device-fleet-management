// server/src/api/devices.js
import { Router } from "express";
import { getDeviceSummary, listDevices, setCustomLocation, unsetCustomLocation } from "../ws.js";

const router = Router();

/** GET /api/devices  → list for Devices page */
router.get("/", (_req, res) => {
  res.json({ devices: listDevices() });
});

/** GET /api/devices/:id/summary  → left card */
router.get("/:id/summary", (req, res) => {
  const id = req.params.id;
  const sum = getDeviceSummary(id);
  res.json(sum);
});

/** POST /api/devices/:id/location  body: {lat, lon, label?}  → set custom location */
router.post("/:id/location", (req, res) => {
  const id = req.params.id;
  const { lat, lon, label } = req.body || {};
  try {
    const geo = setCustomLocation(id, { lat: Number(lat), lon: Number(lon), label });
    res.json({ ok: true, geo });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

/** DELETE /api/devices/:id/location → remove custom location (falls back to IP/device geo) */
router.delete("/:id/location", (req, res) => {
  const id = req.params.id;
  const geo = unsetCustomLocation(id);
  res.json({ ok: true, geo });
});

/** Optional container actions (disabled unless you enabled CONTROL_ENABLED=1) */
router.post("/:id/containers/:name/restart", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

router.post("/:id/containers/:name/stop", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

export default router;
