import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const LOG_ROOT = path.join(process.cwd(), "logs");

function listDeviceIds() {
  if (!fs.existsSync(LOG_ROOT)) return [];
  return fs.readdirSync(LOG_ROOT).filter((n) =>
    fs.statSync(path.join(LOG_ROOT, n)).isDirectory()
  );
}

function deviceInfo(id) {
  const dir = path.join(LOG_ROOT, id);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  let lastSeen = null;
  if (files.length) {
    const f = path.join(dir, files[files.length - 1]);
    lastSeen = fs.statSync(f).mtime;
  }
  const online =
    lastSeen && Date.now() - new Date(lastSeen).getTime() < 60 * 1000;

  return {
    id,
    status: online ? "online" : "offline",
    last_seen: lastSeen ? new Date(lastSeen).toISOString() : null,
    os_version: null,
    supervisor_version: null,
    ip_address: null,
    current_release: null,
    target_release: null,
  };
}

router.get("/", (_req, res) => {
  const ids = listDeviceIds();
  const devices = ids.map(deviceInfo).filter(Boolean);
  devices.sort(
    (a, b) => new Date(b.last_seen || 0) - new Date(a.last_seen || 0)
  );
  res.json({ devices });
});

router.get("/:id", (req, res) => {
  const info = deviceInfo(req.params.id);
  if (!info) return res.status(404).json({ error: "not found" });
  res.json(info);
});

export default router;

