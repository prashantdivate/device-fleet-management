// server/src/api/devices.js
import { Router } from "express";
import { getDeviceSummary, sendControl } from "../ws.js";

const router = Router();

// Normalize env -> boolean (trims whitespace, handles undefined/null)
const CONTROL_ON = String(process.env.CONTROL_ENABLED ?? "")
  .trim()
  .toLowerCase() === "1";

/**
 * GET /api/devices/:id/summary
 */
router.get("/:id/summary", (req, res) => {
  res.json(getDeviceSummary(req.params.id));
});

/**
 * POST /api/devices/:id/reboot
 * Returns 202 when the control frame is queued to the connected device.
 */
router.post("/:id/reboot", (req, res) => {
  // tiny debug so we know exactly what the route sees
  if (!CONTROL_ON) {
    console.log("[api] reboot refused; CONTROL_ENABLED =", process.env.CONTROL_ENABLED);
    return res.status(501).json({ error: "Control disabled on server" });
  }
  const ok = sendControl(req.params.id, { action: "reboot" });
  if (!ok) return res.status(404).json({ error: "Device not connected" });
  return res.status(202).json({ ok: true });
});

/**
 * These are still disabled for now.
 */
router.post("/:id/containers/:name/restart", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});
router.post("/:id/containers/:name/stop", (_req, res) => {
  res.status(501).json({ error: "remote control disabled in this build" });
});

export default router;
