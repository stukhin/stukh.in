import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Pin the workspace root so Turbopack doesn't pick up the stray
  // package-lock.json sitting in $HOME and infer the wrong root.
  turbopack: {
    root,
  },
};

export default nextConfig;
