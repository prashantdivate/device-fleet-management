// src/components/DeviceSidebarRouter.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DeviceSidebar from "./Sidebar.jsx"; // <- the exact-look sidebar we built

// Map sidebar keys -> app routes. Adjust any paths you prefer.
const keyToPath = {
  summary: "/summary",
  "device-config": "/settings",
  "device-overview": "/devices",
  "service-variables": "/devices",
  location: "/devices",
  OTA: "/updates",
  diagnostics: "/logs",
};

// pick the best matching key from current pathname
function computeActiveKey(pathname) {
  // exact matches first
  for (const [k, p] of Object.entries(keyToPath)) {
    if (pathname === p) return k;
  }
  // then prefix matches (for nested routes)
  let best = "summary", bestLen = 0;
  for (const [k, p] of Object.entries(keyToPath)) {
    if (pathname.startsWith(p) && p.length > bestLen) { best = k; bestLen = p.length; }
  }
  return best;
}

export default function DeviceSidebarRouter() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  function handleNavigate(key) {
    const path = keyToPath[key] || "/devices";
    if (path !== pathname) navigate(path);
  }

  return (
    <DeviceSidebar
      active={computeActiveKey(pathname)}
      onNavigate={handleNavigate}
    />
  );
}
