/**
 * Visual stand-ins for each entry in PAGE_ORDER. Painted by
 * ChainBridge as the cross-page slide overlay — every transition
 * (desktop wheel + mobile swipe) goes through the same animation
 * now, so this table is the single source of truth for "what does
 * route X look like during a transition."
 */
export type PageVisual = {
  /** Optional URL for a full-bleed bg image. */
  bg?: string;
  /** Solid colour fallback (also painted under the bg image). */
  color: string;
};

export const PAGE_VISUALS: Readonly<Record<string, PageVisual>> = {
  "/": {
    bg: "/images/gallery/main/desktop/1.webp",
    color: "#0d1117",
  },
  "/nature": {
    bg: "/images/misc/bg_nature.webp",
    color: "#151616",
  },
  "/city": {
    bg: "/images/misc/bg_city.webp",
    color: "#3a3a3a",
  },
  "/walls": {
    color: "#0a0a0c",
  },
  "/blog": {
    /* /blog is now backed by a Grainient WebGL surface in cool
       monochrome grays (color2/color3 = #727272/#717171, color1 =
       #c5c5c5). The slide-bridge colour stands in for the live
       page during the transition; #888 is the visual mid-tone of
       the Grainient palette so the hand-off lands without a
       bright flash. (Pre-Grainient this was cream #f5f4f1.) */
    color: "#888888",
  },
};

/**
 * Runtime overrides for `PAGE_VISUALS[route].bg`. Currently the only
 * mover is HomeSlider, which rotates between four hero photos — when
 * the user navigates away from /, ChainBridge needs to paint the
 * CURRENT slide as the /-route bg, not the static slide-1 default.
 *
 * Earlier this was done by directly mutating PAGE_VISUALS["/"].bg
 * from a useEffect. Module-level mutation from React effects is a
 * race-prone pattern under StrictMode (the double-invocation can
 * leave the override and the React state momentarily out of sync)
 * and concurrent rendering (a paused render might read the new
 * value, restart, then read the old one). Routing through this
 * Map keeps PAGE_VISUALS literally `Readonly` and gives a single
 * intent-revealing call site for changes.
 */
const routeBgOverrides = new Map<string, string>();

export function setRouteBg(route: string, bg: string): void {
  routeBgOverrides.set(route, bg);
}

export function getRouteBg(route: string): string | undefined {
  return routeBgOverrides.get(route) ?? PAGE_VISUALS[route]?.bg;
}

