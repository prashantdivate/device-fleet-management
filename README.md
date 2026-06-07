Install Node for Windows and run in cmd so that wifi Ip can work:

# server
cd server
set HOST=192.168.29.146
set PORT=4000
npm i
npm run dev

# client
cd ..\client
npm i
npm run dev -- --host 192.168.29.146 --port 5173



Running agent on device:

Install pip first-
python3 -m ensurepip

pip3 install websockets

2) Quick start (against your existing Node server)

Demo mode (no real logs):

export SERVER_URL=ws://<SERVER_IP>:4000/ingest
export DEVICE_ID=$(cat /etc/machine-id 2>/dev/null || hostname)
export INPUT=demo
python3 agent.py

Journald:

export SERVER_URL=ws://<SERVER_IP>:4000/ingest
export VERBOSE=1
export INPUT=journal
python3 agent.py

Device location:

For precise installed-device location without exporting coordinates each time,
create `/etc/device-location.json` on the device.

Option A, exact coordinates:

{
  "lat": 12.91792143757691,
  "lon": 77.63338306937608,
  "accuracy_m": 10
}

Option B, installed address:

{
  "address": "1st Avenue, HSR Layout, Bengaluru 560034, Karnataka, India"
}

The agent reads this file automatically before falling back to other sources.
You can override the path with `DEVICE_LOCATION_FILE`.

You can also pass coordinates explicitly:

export GEO_LAT=12.91792143757691
export GEO_LON=77.63338306937608
export GEO_ACCURACY_M=10

If no file, coordinates, or address are configured, the agent falls back to
ipinfo.io and sends approximate public-IP/network coordinates.

export SERVER_URL=ws://<SERVER_IP>:4000/ingest
export VERBOSE=1
export INPUT=journal
python3 agent.py

Optional ipinfo token:

export IPINFO_TOKEN=<token>

The Location page uses the agent-provided `geo` field before the server's own
fallback location.

Files (comma-separated, globs allowed):

export SERVER_URL=ws://<SERVER_IP>:4000/ingest
export INPUT=files
export FILES="/var/log/*.log,/var/lib/docker/containers/*/*-json.log"
python3 agent.py

TLS (wss:// with self-signed while testing):

export SERVER_URL=wss://your.domain/ingest
export TLS_INSECURE=1   # only for lab testing
python3 agent.py
Open your frontend → Summary/Logs with the matching Device ID and you’ll see the stream.

3) Optional: run as a systemd service
/etc/systemd/system/device-agent.service

[Unit]
Description=Device Log Agent (WebSocket)
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/bin/env SERVER_URL=ws://<SERVER_IP>:4000/ingest INPUT=journal DEVICE_ID=%H \
  /usr/bin/python3 /opt/device-agent/agent.py
WorkingDirectory=/opt/device-agent
Restart=always
RestartSec=3s
Environment=SPOOL_DIR=/var/lib/device-agent/spool
Environment=PING_SEC=30
Environment=RECONNECT_MIN=1.5
Environment=RECONNECT_MAX=20
[Install]
WantedBy=multi-user.target

# install
sudo mkdir -p /opt/device-agent
sudo cp agent.py /opt/device-agent/
sudo mkdir -p /var/lib/device-agent/spool
sudo systemctl daemon-reload
sudo systemctl enable --now device-agent
