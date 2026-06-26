import type { NextConfig } from "next";
import path from "node:path";
import os from "node:os";

// Collect this machine's LAN IPv4 addresses so the dev server accepts
// requests coming from http://<lan-ip>:3000 (not just localhost).
function localIPv4s(): string[] {
  const ips: string[] = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

const lanIPs = localIPv4s();

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't get confused by
  // other package-lock.json files higher up the directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Allow the dev server (HMR / RSC / server actions) to be opened from the
  // machine's LAN IP, not only localhost.
  allowedDevOrigins: lanIPs,
};

export default nextConfig;
