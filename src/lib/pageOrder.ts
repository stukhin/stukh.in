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
    type ChainWindow = Window & {
      __stukhinChainFrom?: string;
    };
    (window as unknown as ChainWindow).__stukhinChainFrom = from;
    window.dispatchEvent(
      new CustomEvent("chainNavigate", { detail: { from, to } })
    );
    return;
  }

  // Off-strip / same-page: plain router push, no animation.
  router.push(to);
}
