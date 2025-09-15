import React from "react";
import { Routes, Route, NavLink, Navigate } from "react-router-dom";
import { SessionProvider } from "./ctx/SessionContext.jsx";

import Summary from "./pages/Summary.jsx";      // <— renamed
import Devices from "./pages/Devices.jsx";
import Logs from "./pages/Logs.jsx";
import Terminal from "./pages/Terminal.jsx";
import Updates from "./pages/Updates.jsx";
import Settings from "./pages/Settings.jsx";

function Sidebar() {
  return (
    <>
      <h2 className="title">Menu</h2>
      <nav className="nav">
        <NavLink to="/summary"  className={({isActive}) => "navlink" + (isActive ? " active" : "")}>Summary</NavLink>
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
          <Route index element={<Navigate to="/summary" replace />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/summary" replace />} />
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

