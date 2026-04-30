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

/**
 * Duration (ms) of each intermediate slide while a chained navigation
 * is in flight. The CSS override lives in globals.css under
 * `html.chain-step ::view-transition-group(root)`. Keep these two in
 * sync — the JS schedules the next step here, the CSS makes the
 * transition itself fit inside the budget.
 */
const CHAIN_STEP_MS = 560;

type ChainRouter = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

/**
 * Navigate from `from` to `to` by stepping through every intermediate
 * page in PAGE_ORDER, so the user visibly slides past each in-between
 * block instead of jumping straight there. Adjacent navigations and
 * navigations involving routes outside PAGE_ORDER fall through to a
 * single push.
 *
 * Intermediate steps use replace() to keep the browser back-stack
 * tidy: hitting Back from `to` lands you on `from` directly, not on
 * a half-seen intermediate.
 */
export function navigateChained(
  router: ChainRouter,
  from: string,
  to: string
): void {
  const fromIdx = PAGE_ORDER.indexOf(from);
  const toIdx = PAGE_ORDER.indexOf(to);

  // Same page, off-strip route, or already adjacent — single slide.
  if (
    fromIdx === -1 ||
    toIdx === -1 ||
    fromIdx === toIdx ||
    Math.abs(fromIdx - toIdx) === 1
  ) {
    setTransitionDirection(getDirection(from, to));
    if (typeof document !== "undefined") {
      document.documentElement.classList.remove("chain-step");
    }
    router.push(to);
    return;
  }

  const direction: TransitionDirection =
    toIdx > fromIdx ? "forward" : "backward";
  const step = direction === "forward" ? 1 : -1;
  const stops: string[] = [];
  for (let i = fromIdx + step; i !== toIdx; i += step) {
    stops.push(PAGE_ORDER[i]);
  }
  stops.push(to);

  let cumulative = 0;
  stops.forEach((href, i) => {
    const isFinal = i === stops.length - 1;
    window.setTimeout(() => {
      setTransitionDirection(direction);
      if (isFinal) {
        document.documentElement.classList.remove("chain-step");
        router.push(href);
      } else {
        document.documentElement.classList.add("chain-step");
        router.replace(href);
      }
    }, cumulative);
    if (!isFinal) cumulative += CHAIN_STEP_MS;
  });
}
