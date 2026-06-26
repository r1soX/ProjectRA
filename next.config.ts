import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Next doesn't get confused by
  // other package-lock.json files higher up the directory tree.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
