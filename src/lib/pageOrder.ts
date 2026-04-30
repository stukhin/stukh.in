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
 * Per-step durations for chained navigation. The first slide has a
 * gentle ease-in (the strip "winds up" from rest); intermediate
 * slides run at constant linear speed so the chain reads as one
 * continuous scroll, no visible stops between blocks; the last slide
 * uses the same constant speed but eases out to a stop.
 *
 * Keep these in sync with the matching `html.chain-first/-mid/-last`
 * rules in globals.css — the JS schedules the next step here, the
 * CSS makes each transition fit inside its budget.
 */
const CHAIN_FIRST_MS = 600;
const CHAIN_MID_MS = 520;
const CHAIN_LAST_MS = 700;

const CHAIN_CLASSES = ["chain-first", "chain-mid", "chain-last"] as const;

function clearChainClasses() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(...CHAIN_CLASSES);
}

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
    clearChainClasses();
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
    const isFirst = i === 0;
    const isFinal = i === stops.length - 1;
    const cls = isFinal ? "chain-last" : isFirst ? "chain-first" : "chain-mid";
    const stepDuration = isFinal
      ? CHAIN_LAST_MS
      : isFirst
        ? CHAIN_FIRST_MS
        : CHAIN_MID_MS;

    window.setTimeout(() => {
      setTransitionDirection(direction);
      clearChainClasses();
      document.documentElement.classList.add(cls);
      if (isFinal) {
        router.push(href);
      } else {
        router.replace(href);
      }
    }, cumulative);
    cumulative += stepDuration;
  });

  // Drop the chain class once the final slide has settled, so the
  // next single navigation isn't accidentally tagged.
  window.setTimeout(clearChainClasses, cumulative + 100);
}
