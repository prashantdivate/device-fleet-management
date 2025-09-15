import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { SessionProvider, useSession } from "./ctx/SessionContext.jsx";

import Overview from "./pages/Overview.jsx";
import Devices from "./pages/Devices.jsx";
import Logs from "./pages/Logs.jsx";
import Terminal from "./pages/Terminal.jsx";
import Updates from "./pages/Updates.jsx";
import Settings from "./pages/Settings.jsx";

function Sidebar() {
  const { deviceId, setDeviceId, ssh, setSsh } = useSession();
  return (
    <>
      <h2 className="title">Device Summary</h2>

      <div className="section">
        <label>Device ID</label>
        <input
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="MACHINE_ID or label"
        />
      </div>

      <div className="section">
        <label>SSH Host</label>
        <input
          value={ssh.host}
          onChange={(e) => setSsh({ ...ssh, host: e.target.value })}
          placeholder="192.168.x.x"
        />
        <div className="row">
          <div className="col">
            <label>User</label>
            <input value={ssh.user} onChange={(e) => setSsh({ ...ssh, user: e.target.value })} />
          </div>
          <div className="col">
            <label>Port</label>
            <input
              type="number"
              value={ssh.port}
              onChange={(e) => setSsh({ ...ssh, port: parseInt(e.target.value || "22", 10) })}
            />
          </div>
        </div>
        <label>Password (prototype)</label>
        <input
          type="password"
          value={ssh.password || ""}
          onChange={(e) => setSsh({ ...ssh, password: e.target.value })}
        />
        <p className="hint">For demo only. Prefer SSH keys + TLS in production.</p>
      </div>

      <nav className="nav">
        <NavLink to="/overview" className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Overview</NavLink>
        <NavLink to="/devices"  className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Devices</NavLink>
        <NavLink to="/logs"     className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Live Logs</NavLink>
        <NavLink to="/terminal" className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Terminal</NavLink>
        <NavLink to="/updates"  className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Updates</NavLink>
        <NavLink to="/settings" className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Settings</NavLink>
      </nav>
    </>
  );
}

function Layout() {
  return (
    <div className="page">
      <aside className="sidebar">
        <Sidebar />
      </aside>
      <main className="right">
        <Routes>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Overview />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Layout />
    </SessionProvider>
  );
}

