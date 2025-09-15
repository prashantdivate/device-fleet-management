/**
 * Dummy device log generator.
 * Usage:
 *   node src/simulate-logs.js --device demo-123 --host localhost --port 4000 --rate 5
 * Env vars also supported: DEVICE_ID, WS_HOST, WS_PORT, RATE
 */
import { WebSocket } from 'ws';

function arg(k, def){ 
  const pref = `--${k}=`;
  const a = process.argv.find(x => x.startsWith(pref)); 
  if (a) return a.slice(pref.length);
  return process.env[(k||'').toUpperCase()] ?? def;
}

const deviceId = arg('device', 'demo-001');
const host = arg('host', 'localhost');
const port = parseInt(arg('port', '4000'), 10);
const rate = parseInt(arg('rate', '5'), 10); // messages per second

const url = `ws://${host}:${port}/ingest?device_id=${encodeURIComponent(deviceId)}`;
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log(`[sim] connected -> ${url}`);
  let i = 0;
  const levels = ['DEBUG','INFO','WARN','ERROR'];
  const units = ['app.service','net.service','update.service','sensor.service'];
  const timers = [];

  const sendOne = () => {
    i += 1;
    const now = new Date();
    const obj = {
      device_id: deviceId,
      _SYSTEMD_UNIT: units[i % units.length],
      PRIO: levels[(i % 17) % levels.length],
      MESSAGE: sampleMessage(i),
      TS: now.toISOString()
    };
    ws.send(JSON.stringify(obj));
  };

  const intervalMs = Math.max(10, Math.floor(1000 / rate));
  const t = setInterval(sendOne, intervalMs);
  timers.push(t);

  process.on('SIGINT', () => { timers.forEach(clearInterval); ws.close(); process.exit(0); });
});

ws.on('close', () => console.log('[sim] disconnected'));
ws.on('error', (e) => console.error('[sim] error:', e.message));

function sampleMessage(i){
  const msgs = [
    'Starting service…',
    'Applying configuration change',
    'Downloading image layer',
    'Container started',
    'Healthcheck passed',
    'Network reconnected',
    'Sensor reading OK',
    'Restarting unit',
    'WARNING: high CPU',
    'ERROR: IO timeout, retrying'
  ];
  return `${msgs[i % msgs.length]} (seq=${i})`;
}
