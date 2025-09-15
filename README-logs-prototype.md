
# Local Realtime Logs + Terminal (Prototype)

This is your modified MERN project with **both backend and frontend** for:
- WebSocket log ingest from devices (Fluent Bit via `websocket` output).
- Live log viewing in the UI (right/top).
- Browser SSH terminal (right/bottom) via a WS → SSH proxy.

## How to run (dev)

### 1) Backend
```
cd server
npm install
npm run dev
```
- Listens on `:4000`
- WS endpoints:
  - `ws://HOST:4000/ingest?device_id=ID`  ← device pushes logs (json lines)
  - `ws://HOST:4000/live?device_id=ID`    ← browser subscribes
  - `ws://HOST:4000/term?...`             ← browser SSH terminal

### 2) Frontend
```
cd client
npm install
npm run dev
```
Open http://localhost:5173/

> If your backend is not on localhost:4000, set `VITE_WS_BASE` in `client/.env.local`:
```
VITE_WS_BASE=ws://SERVER_IP:4000
```

### 3) Fluent Bit config (on device)
```
[SERVICE]
    Flush           1
    Log_Level       info
    storage.path    /var/fluent-bit/buffer

[INPUT]
    Name            systemd
    Tag             host.*
    Read_From_Tail  On
    storage.type    filesystem

[FILTER]
    Name            modify
    Match           *
    Add             device_id    DEVICE_ID
    Add             device_name  DEVICE_HOSTNAME

[OUTPUT]
    Name            websocket
    Match           *
    Host            <SERVER_IP>
    Port            4000
    URI             /ingest?device_id=DEVICE_ID
    Format          json_lines
    net.keepalive   on
```

## Production note
For `wss://` you can place Nginx in front to terminate TLS and proxy to this server.

## Security
The SSH proxy is for **prototype** only (uses user/password via querystring).
For production switch to mTLS for device ingest and a proper auth flow for terminal access.
