import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSession } from '../ctx/SessionContext.jsx';
import { Icon } from './icons.jsx'; // kept as fallback (optional)

// === Import your custom SVGs here ===
// If you use URL-style imports (CRA/Vite defaults), these will be strings.
// If you use SVGR, they'll be React components.
import icondev from '../pages/icons/summary.svg';
import iconcloud from '../pages/icons/cloud.svg';
import iconconfig from '../pages/icons/setting2.svg';
import iconservice from '../pages/icons/system.svg';
import iconlocation from '../pages/icons/location.svg';
import iconupdate from '../pages/icons/update.svg';
import icondiagnostics from '../pages/icons/diagnostics.svg';

// Central place to register all file icons
const ICON_FILES = {
  device: iconcloud,
  summary: icondev,
  config: iconconfig,
  service: iconservice,
  location: iconlocation,
  update: iconupdate,
  diagnostics: icondiagnostics,
};

// Make icons “somewhat smaller”. Adjust as you like.
const ICON_SIZE = 45;

const NAV_ITEMS = [
  { key: 'device-overview',  iconFile: 'device',       primary: 'Device',          secondary: 'Overview' },
  { key: 'summary',          iconFile: 'summary',      primary: 'Summary' },
  { key: 'device-config',    iconFile: 'config',       primary: 'Device',          secondary: 'Configuration' },
  { key: 'service-variables',iconFile: 'service',      primary: 'Device Service',  secondary: 'Variables' },
  { key: 'location',         iconFile: 'location',     primary: 'Location' },
  { key: 'OTA',              iconFile: 'update',       primary: 'OTA' },
  { key: 'diagnostics',      iconFile: 'diagnostics',  primary: 'Device',          secondary: 'diagnostics' },
];

function cx(...cls) { return cls.filter(Boolean).join(' '); }

// Optional: kept in case you still use monograms anywhere.
function DSMonogram({ letter }) {
  return (
    <span className="dsmono" aria-hidden>
      <i>{letter}</i><span className="paren">(</span><sup>x</sup><span className="paren">)</span>
    </span>
  );
}

function FileIcon({ fileKey, size = ICON_SIZE }) {
  const File = ICON_FILES[fileKey];
  if (!File) return null;

  // URL-string import (common in CRA/Vite)
  if (typeof File === 'string') {
    return <img src={File} alt="" aria-hidden style={{ width: size, height: size, display: 'block' }} />;
  }

  // SVGR React component import
  return <File aria-hidden width={size} height={size} style={{ width: size, height: size, display: 'block' }} />;
}

export default function DeviceSidebar({ active, onNavigate, className }) {
  const [current, setCurrent] = useState(active || 'summary');
  const { deviceId } = useSession();

  useEffect(() => { if (active) setCurrent(active); }, [active]);

  // NOTE: Diagnostics always routes to /devices (never per-device directly)
  const pathFor = (key) => {
    if (key === 'device-overview') return '/devices';
    if (key === 'summary')         return deviceId ? `/summary/${encodeURIComponent(deviceId)}` : '/devices';
    if (key === 'diagnostics')     return '/devices';
    return null; // other items handled by onNavigate
  };

  return (
    <aside className={cx('deviceSidebar exact', className)} aria-label="Sidebar">
      <nav className="stack">
        {NAV_ITEMS.map(({ key, iconFile, monogram, primary, secondary, icon }) => {
          const selected = key === current;
          const to = pathFor(key);

          const CardInner = (
            <div className="nav-inner">
              <span className="icon" aria-hidden>
                {/* Prefer custom file icons for ALL items; fall back to monogram/Icon if needed */}
                {iconFile
                  ? <FileIcon fileKey={iconFile} />
                  : monogram
                    ? <DSMonogram letter={monogram} />
                    : icon
                      ? <Icon name={icon} />
                      : null}
              </span>
              <span className="text">
                <span className="primary">{primary}</span>
                {secondary ? <span className="secondary">{secondary}</span> : null}
              </span>
            </div>
          );

          // For known pages, render real links so routing happens without hooks.
          if (to) {
            return (
              <NavLink
                key={key}
                to={to}
                className={({ isActive }) => cx('nav-card', (isActive || selected) && 'is-active')}
                aria-current={selected ? 'page' : undefined}
                onClick={() => setCurrent(key)}
              >
                {CardInner}
              </NavLink>
            );
          }

          // For the rest, keep your existing callback behavior.
          return (
            <button
              key={key}
              className={cx('nav-card', selected && 'is-active')}
              aria-current={selected ? 'page' : undefined}
              onClick={() => { setCurrent(key); onNavigate?.(key); }}
            >
              {CardInner}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
