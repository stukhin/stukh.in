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
  // Home page = the paper island, a ready-made static build in
  // public/ (island.html + js/, models/, img/, rooms.js). Its asset
  // paths are relative, so it must be served from `/`. The old
  // src/app/page.tsx stays in place; drop this rule to roll back.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/island.html" }],
    };
  },
  // Island assets have no content hash in their names → modest caching.
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
      {
        source: "/js/draco/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
