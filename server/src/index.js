import http from "http";
import path from "path";
import fs from "fs";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import { setupWs } from "./ws.js";

dotenv.config();

const app = express();
//app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*", credentials: true }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

import devicesRouter from "./api/devices.js";

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/devices", devicesRouter);

// Serve built frontend if available
const buildDir = process.env.CLIENT_BUILD_DIR && path.resolve(process.env.CLIENT_BUILD_DIR);
if (buildDir && fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get("*", (req, res) => res.sendFile(path.join(buildDir, "index.html")));
}

const server = http.createServer(app);
setupWs(server);

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => console.log(`Server listening on ${HOST}:${PORT}`));
