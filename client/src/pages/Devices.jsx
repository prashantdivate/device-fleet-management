import React from "react";

export default function Devices() {
  return (
    <section className="card fill">
      <div className="card-header"><h3>Devices</h3></div>
      <div style={{padding:12}}>
        <p>Coming soon: list devices detected from incoming logs (server/logs/*).</p>
        <ul className="summary">
          <li>Search & filters (site, status, version)</li>
          <li>Click a device → open its logs/terminal</li>
          <li>Bulk actions (restart service, set log level)</li>
        </ul>
      </div>
    </section>
  );
}

