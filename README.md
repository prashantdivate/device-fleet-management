# Device Log Prototype (Local-only)

This is a minimal full‑stack prototype that collects **device logs over WebSocket** and shows them in a web UI.
It also includes a **web SSH terminal** to the device (prototype: password-based via `ssh2`).

## Run (development)

### 1) Backend
```bash
cd server
npm i
npm run dev
# listens on :4000
```

### 2) Frontend
```bash
cd ../client
npm i
npm run dev
# opens http://localhost:5173
```

Vite dev server proxies `/live` and `/ssh` to the backend.

## Configure devices (Fluent Bit)

On the device, point Fluent Bit to your server:
```ini
[OUTPUT]
    Name    websocket
    Match   *
    Host    <YOUR_SERVER_IP>
    Port    4000
    URI     /ingest?device_id=${MACHINE_ID}
    Format  json_lines
```

## Production build (optional)
```bash
cd client && npm run build
cd ../server
# set path so Express serves the built files:
echo "CLIENT_BUILD_DIR=../client/dist" >> .env
npm start
# server will serve the built UI and websockets on the same :4000
```

## SSH (prototype)
- Click **Connect** in the “Device Terminal” section after entering `host`, `user`, `password`, `port`.
- For production: switch to key-based auth and put TLS/mTLS in front of the server.

## Notes
- Logs are stored as JSONL under `server/logs/<deviceId>/YYYY-MM-DD.jsonl` and a small in-memory tail is kept for fast initial load.
- UI layout mimics the screenshot: **right top** = realtime logs, **right bottom** = SSH terminal; **left** = summary/inputs.
