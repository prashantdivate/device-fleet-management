import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import "xterm/css/xterm.css";

export default function SshTerminal({ host, user, password, port=22 }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  const connect = () => {
    if (!host) return;
    const ws = new WebSocket(`/ssh?host=${encodeURIComponent(host)}&user=${encodeURIComponent(user||"root")}&port=${port}&password=${encodeURIComponent(password||"")}`);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => setStatus("connected");
    ws.onclose = () => setStatus("disconnected");
    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "status") { /* maybe show toast */ }
          if (msg.type === "error") { termRef.current?.writeln(`\r\n[SSH ERROR] ${msg.message}`); }
        } catch { termRef.current?.write(e.data); }
      } else {
        const text = new TextDecoder().decode(e.data);
        termRef.current?.write(text);
      }
    };
    wsRef.current = ws;
  };

  const disconnect = () => wsRef.current?.close();

  useEffect(() => {
    const term = new Terminal({ convertEol: true, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 });
    term.open(containerRef.current);
    termRef.current = term;
    term.onData(data => wsRef.current?.send(data));
    return () => { term.dispose(); wsRef.current?.close(); };
  }, []);

  return (
    <div className="term-wrap">
      <div className="term-toolbar">
        <button onClick={status==='connected'?disconnect:connect}>
          {status==='connected' ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      <div className="term-pane" ref={containerRef} />
    </div>
  );
}
