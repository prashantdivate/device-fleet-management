// server/src/api/devices.js
import { Router } from "express";
import { getDeviceSummary } from "../ws.js";

const router = Router();

/**
 * GET /api/devices/:id/summary
 * Returns { device_id, online, snapshot, os, ips, runtime, containers, _serverTs, control }
 */
router.get("/:id/summary", (req, res) => {
  const id = req.params.id;
  const sum = getDeviceSummary(id);
  res.json(sum);
});

/**
 * Optional container actions (stubbed disabled by default).
 * Frontend will gray them out unless control.enabled === true.
 */
router.post("/:id/containers/:name/restart", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

router.post("/:id/containers/:name/stop", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

export default router;
