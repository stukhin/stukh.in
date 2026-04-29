/**
 * The site is conceptually one tall vertical strip of "blocks". Pages
 * always render in this fixed order, so the cross-page slide animation
 * can pick a direction (forward = down, backward = up) based on where
 * you came from and where you're going.
 *
 * Routes not listed here (e.g. /order, /404) are treated as forward
 * transitions to keep the default behaviour.
 */
export const PAGE_ORDER = ["/", "/nature", "/city", "/walls", "/trips"];

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
