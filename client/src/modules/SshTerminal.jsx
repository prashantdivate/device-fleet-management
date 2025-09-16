import React from "react";

export default function SshTerminal() {
  return (
    <div className="term-wrap">
      <div className="term-toolbar">
        {/* your Connect/Disconnect buttons, etc. */}
      </div>
      <div className="term-pane" id="xterm-container" />
    </div>
  );
}

