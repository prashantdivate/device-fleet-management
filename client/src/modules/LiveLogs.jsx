import React, { useEffect, useRef, useState } from "react";

export default function LiveLogs({ deviceId }) {
  const [connected, setConnected] = useState(false);
  const [lines, setLines] = useState([]);
  const boxRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!deviceId) return;
    const ws = new WebSocket(`/live?device_id=${encodeURIComponent(deviceId)}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => setLines(prev => [...prev, e.data].slice(-2000));
    return () => ws.close();
  }, [deviceId]);

  // keep view pinned to bottom
  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  return (
    <pre ref={boxRef} className="logs-pane">
      {deviceId ? lines.join("\n") : "Enter a Device ID on the left, then start your agent or simulator."}
    </pre>
  );
}

