// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./ctx/SessionContext.jsx";

import DeviceSidebarRouter from "./components/DeviceSidebarRouter.jsx";

// pages
import Summary from "./pages/Summary.jsx";
import Devices from "./pages/Devices.jsx";
import Diagnostics from "./pages/Diagnostics.jsx";
import Terminal from "./pages/Terminal.jsx";
import Updates from "./pages/Updates.jsx";
import Settings from "./pages/Settings.jsx";
import Map from "./pages/map.jsx";

function Layout() {
  return (
    
    <div className="shell"> {/* new wrapper to avoid style clashes */}
      <aside className="left-nav"><DeviceSidebarRouter /></aside>

      <main className="main-pane">
        <Routes>
          {/* Default landing goes to Devices */}
          <Route index element={<Navigate to="/devices" replace />} />

          {/* Devices */}
          <Route path="/devices" element={<Devices />} />

          {/* Summary: only deep-linkable; bare /summary -> /devices */}
          <Route path="/summary/:id" element={<Summary />} />
          <Route path="/summary" element={<Navigate to="/devices" replace />} />

          {/* Diagnostics: only deep-linkable; bare /diagnostics -> /devices */}
          <Route path="/diagnostics/:deviceId" element={<Diagnostics />} />
          <Route path="/diagnostics" element={<Navigate to="/devices" replace />} />

          {/* Other pages */}
          <Route path="/terminal" element={<Terminal />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/map" element={<Map />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/devices" replace />} />
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
