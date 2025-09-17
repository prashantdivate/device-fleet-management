// server/src/api/devices.js
import { Router } from "express";
import { getDeviceSummary, listDevices } from "../ws.js";

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

/** Optional container actions (disabled unless you enabled CONTROL_ENABLED=1) */
router.post("/:id/containers/:name/restart", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

router.post("/:id/containers/:name/stop", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

export default router;
