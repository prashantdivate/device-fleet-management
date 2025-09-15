import { createContext, useContext, useEffect, useState } from "react";

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [deviceId, setDeviceId] = useState(localStorage.getItem("deviceId") || "");
  const [ssh, setSsh] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ssh") || "{}") || {}; }
    catch { return {}; }
  });

  if (!ssh.user) ssh.user = "root";
  if (!ssh.port) ssh.port = 22;
  if (!ssh.host) ssh.host = "";

  useEffect(() => localStorage.setItem("deviceId", deviceId), [deviceId]);
  useEffect(() => localStorage.setItem("ssh", JSON.stringify(ssh)), [ssh]);

  return <Ctx.Provider value={{ deviceId, setDeviceId, ssh, setSsh }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

