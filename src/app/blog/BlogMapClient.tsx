"use client";

import dynamic from "next/dynamic";

/**
 * Client wrapper that dynamic-imports BlogMap with `ssr: false`. The
 * parent /blog Server Component (page.tsx) keeps its `metadata`
 * export and static prerendering; the heavy map (BlogMap + the 300 KB
 * world-atlas TopoJSON + d3-geo + ogl) lands in its own code-split
 * chunk that only loads once /blog is on screen. Without this
 * wrapper, calling `dynamic({ ssr: false })` from a Server Component
 * is a Next.js App Router build error.
 */
const BlogMap = dynamic(() => import("@/components/BlogMap/BlogMap"), {
  ssr: false,
});

export default function BlogMapClient() {
  return <BlogMap />;
}
