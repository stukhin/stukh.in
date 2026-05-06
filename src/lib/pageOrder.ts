/**
 * The site is conceptually one tall vertical strip of "blocks". Pages
 * always render in this fixed order, so the cross-page slide animation
 * can pick a direction (forward = down, backward = up) based on where
 * you came from and where you're going.
 *
 * Routes not listed here (e.g. /order, /404) are treated as forward
 * transitions to keep the default behaviour.
 */
export const PAGE_ORDER = ["/", "/nature", "/city", "/walls", "/blog"];

export type TransitionDirection = "forward" | "backward";

export function getDirection(from: string, to: string): TransitionDirection {
  const fromIdx = PAGE_ORDER.indexOf(from);
  const toIdx = PAGE_ORDER.indexOf(to);
  if (fromIdx === -1 || toIdx === -1) return "forward";
  return toIdx >= fromIdx ? "forward" : "backward";
}

/**
 * Toggle a marker class on <html> right before the navigation runs so
 * CSS rules in globals.css can pick the matching slide animation.
 */
export function setTransitionDirection(direction: TransitionDirection) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(
    "transition-forward",
    "transition-backward"
  );
  document.documentElement.classList.add(`transition-${direction}`);
}

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
    setTransitionDirection(getDirection(from, to));
    window.dispatchEvent(
      new CustomEvent("chainNavigate", { detail: { from, to } })
    );
    return;
  }

  // Off-strip / same-page: plain router push, no animation.
  setTransitionDirection(getDirection(from, to));
  router.push(to);
}
