import React, { useEffect, useState } from 'react'
import { Icon } from './icons.jsx'

const NAV_ITEMS = [
  { key: 'summary', icon: 'grid', primary: 'Summary' },
  { key: 'device-config', icon: 'wrench', primary: 'Device', secondary: 'Configuration' },
  { key: 'device-variables', monogram: 'D', primary: 'Device', secondary: 'Variables' },
  { key: 'service-variables', monogram: 'S', primary: 'Device Service', secondary: 'Variables' },
  { key: 'location', icon: 'location', primary: 'Location' },
  { key: 'actions', icon: 'ellipsis', primary: 'Actions' },
  { key: 'diagnostics', icon: 'diagnostics', primary: 'Diagnostics', secondary: 'Experimental' }
];

function cx(...cls) { return cls.filter(Boolean).join(' '); }

function DSMonogram({ letter }) {
  return (
    <span className="dsmono" aria-hidden>
      <i>{letter}</i><span className="paren">(</span><sup>x</sup><span className="paren">)</span>
    </span>
  );
}

export default function DeviceSidebar({ active, onNavigate, className }) {
  const [current, setCurrent] = useState(active || 'summary');
  useEffect(() => { if (active) setCurrent(active); }, [active]);

  const handleClick = (key) => { setCurrent(key); onNavigate?.(key); };

  return (
    <aside className={cx('deviceSidebar exact', className)} aria-label="Sidebar">
      <nav className="stack">
        {NAV_ITEMS.map(({ key, icon, monogram, primary, secondary }) => {
          const isActive = key === current;
          return (
            <button
              key={key}
              className={cx('nav-card', isActive && 'is-active')}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleClick(key)}
            >
              <div className="nav-inner">
                <span className="icon" aria-hidden>
                  {monogram ? <DSMonogram letter={monogram} /> : <Icon name={icon} />}
                </span>
                <span className="text">
                  <span className="primary">{primary}</span>
                  {secondary ? <span className="secondary">{secondary}</span> : null}
                </span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
