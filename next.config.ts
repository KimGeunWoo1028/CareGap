import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Parent directory has its own package.json/lockfile; pin the app root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
