/**
 * Visual stand-ins for each entry in PAGE_ORDER. Used by ChainBridge
 * (the slide overlay) and by useVerticalPageSwipe (the touch-drag
 * preview) so a finger drag and a click-driven nav share the same
 * "what does the next page look like" snapshot.
 */
export type PageVisual = {
  /** Optional URL for a full-bleed bg image. */
  bg?: string;
  /** Solid colour fallback (also painted under the bg image). */
  color: string;
};

export const PAGE_VISUALS: Record<string, PageVisual> = {
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
    color: "#0a0a0c",
  },
};

export function pageVisualFor(href: string): PageVisual {
  return PAGE_VISUALS[href] || { color: "#0a0a0c" };
}
