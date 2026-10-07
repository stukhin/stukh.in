/**
 * The site is conceptually one tall vertical strip of "blocks". Pages
 * always render in this fixed order so ChainBridge can determine
 * whether a navigation moves forward (down) or backward (up).
 *
 * Routes not listed here (e.g. /order, /404) skip ChainBridge and
 * use a plain router push.
 */
export const PAGE_ORDER = ["/", "/nature", "/city", "/walls", "/blog"];

type ChainRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/**
 * True while something else owns the screen and page-strip gestures
 * (desktop wheel, mobile vertical swipe) must not navigate under it:
 * a photo zoom, the /blog country panel, the open menu or walls zoom
 * (both lock scroll with `body.hidden`), the first-visit preloader, a
 * chain transition still in flight (the next page's freshly mounted
 * hooks would otherwise accept the same gesture's tail), or a
 * pinch-zoomed viewport where a one-finger pan is just looking around.
 */
export function pageNavBlocked(): boolean {
  if (typeof document === "undefined") return false;
  const html = document.documentElement.classList;
  return (
    html.contains("zoom-open") ||
    html.contains("blog-panel-open") ||
    html.contains("chain-pending") ||
    html.contains("preloading") ||
    document.body.classList.contains("hidden") ||
    (window.visualViewport?.scale ?? 1) > 1.01
  );
}

/**
 * Navigate from `from` to `to`. ALL in-strip navigations (any pair
 * of routes inside PAGE_ORDER) are handed off to ChainBridge, which
 * runs a single continuous translateY animation across stacked
 * page-bg slides. The shell (Logo / TopNav / Burger) paints ABOVE
 * the bridge, so its mix-blend-mode: difference reads the bridge
 * pixels live and the colour boundary tracks the moving page edge
 * per-pixel — that's the effect we couldn't get with the View
 * Transitions API (each transition group is its own stacking
 * context, blend modes don't reach across groups).
 *
 * Off-strip navigations (e.g. /order, /system) just hard-push.
 */
export function navigateChained(
  router: ChainRouter,
  from: string,
  to: string
): void {
  const fromIdx = PAGE_ORDER.indexOf(from);
  const toIdx = PAGE_ORDER.indexOf(to);

  // Strip navigation (1 hop or many): hand off to ChainBridge.
  if (
    fromIdx !== -1 &&
    toIdx !== -1 &&
    fromIdx !== toIdx &&
    typeof window !== "undefined"
  ) {
    // Stash the from-path on a window key so TopNav (which
    // remounts on every chain navigation because AppShell is
    // per-page) can render with the OLD active link initially and
    // then animate it back down while the NEW active rises — both
    // bars travel mirror-symmetrically instead of the leaving one
    // snapping. Cleared again by ChainBridge once the slide settles.
    // Window is augmented in src/types/global.d.ts so the property
    // is just there — no cast needed.
    window.__stukhinChainFrom = from;
    window.dispatchEvent(
      new CustomEvent("chainNavigate", { detail: { from, to } })
    );
    return;
  }

  // Off-strip / same-page: plain router push, no animation.
  router.push(to);
}
