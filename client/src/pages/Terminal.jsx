import React from "react";
import { useSession } from "../ctx/SessionContext.jsx";
import SshTerminal from "../modules/SshTerminal.jsx";

export default function Terminal() {
  const { ssh } = useSession();
  return (
    <section className="card fill">
      <div className="card-header">
        <h3>Terminal</h3>
        <div className="pill">{ssh.host || "no host"}</div>
      </div>
      <SshTerminal {...ssh} />
    </section>
  );
}

