"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe a component to a CSS media query and re-render when the
 * match flips. Returns `false` during SSR / before mount so the first
 * client render still matches the server-side HTML (no hydration
 * mismatch). After mount the live value lands on the second render.
 *
 * Replaces 10+ scattered `window.matchMedia("(hover: none)").matches`
 * checks inside useEffect bodies, most of which were either:
 *   - one-shot (read once, never react to changes), so a media-change
 *     mid-session went unnoticed; or
 *   - duplicated literal strings, so a typo in one place silently
 *     diverged from the others.
 *
 * Pre-defined string constants below cover the queries the site
 * actually uses; pass any other CSS string directly if needed.
 */
export const MQ = {
  TOUCH: "(hover: none)",
  REDUCED_MOTION: "(prefers-reduced-motion: reduce)",
  DESKTOP_WIDE: "(min-width: 1280px)",
} as const;

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    // addEventListener is the modern API; the older addListener path
    // is no longer needed on any browser the site targets.
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);

  return matches;
}
