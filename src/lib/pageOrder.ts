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
 * Navigate from `from` to `to`. Adjacent and off-strip navigations
 * use the normal view-transition slide. Multi-step navigations
 * (jumping over 2+ blocks in PAGE_ORDER) defer to ChainBridge, which
 * runs ONE continuous CSS transform across stacked page-bg slides
 * — that's what eliminates the per-step jerks the user saw with
 * chained view-transitions.
 *
 * The actual route change for the multi-step case happens inside
 * ChainBridge as soon as the bridge mounts, so the destination page
 * has the full bridge animation to render behind the overlay.
 */
export function navigateChained(
  router: ChainRouter,
  from: string,
  to: string
): void {
  const fromIdx = PAGE_ORDER.indexOf(from);
  const toIdx = PAGE_ORDER.indexOf(to);

  // Multi-step on the strip: hand off to ChainBridge.
  if (
    fromIdx !== -1 &&
    toIdx !== -1 &&
    Math.abs(fromIdx - toIdx) >= 2 &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(
      new CustomEvent("chainNavigate", { detail: { from, to } })
    );
    return;
  }

  // Single slide for adjacent, same-page, or off-strip navigations.
  setTransitionDirection(getDirection(from, to));
  router.push(to);
}
