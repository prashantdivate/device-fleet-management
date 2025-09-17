// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./ctx/SessionContext.jsx";

import DeviceSidebarRouter from "./components/DeviceSidebarRouter.jsx";

// pages
import Summary from "./pages/Summary.jsx";
import Devices from "./pages/Devices.jsx";
import Logs from "./pages/Logs.jsx";
import Terminal from "./pages/Terminal.jsx";
import Updates from "./pages/Updates.jsx";
import Settings from "./pages/Settings.jsx";

function Layout() {
  return (
    
    <div className="shell"> {/* new wrapper to avoid style clashes */}
      <aside className="left-nav"><DeviceSidebarRouter /></aside>

      <main className="main-pane">
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
