// server/src/store.js
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const LOC_FILE = path.join(DATA_DIR, "custom-locations.json");

function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJson(file, obj) { ensureDir(); fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }

// Map device_id -> { lat:Number, lon:Number, label?:String, updatedAt:String }
export function loadCustomLocations() { ensureDir(); return readJsonSafe(LOC_FILE, {}); }
export function saveCustomLocations(map) { writeJson(LOC_FILE, map); }
