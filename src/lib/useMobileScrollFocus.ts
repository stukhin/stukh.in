"use client";

import { MutableRefObject, useEffect } from "react";

/**
 * Mobile-only "focus-on-centre" scroll effect for the Walls grid:
 *
 *  - The two cards in the row whose vertical centre is closest to
 *    the viewport's vertical centre render at their full 9:16
 *    height ("expansion = 1").
 *  - Cards above and below taper smoothly down to a quarter of
 *    their full height as they move away from centre
 *    ("expansion = 0.25"). The image inside keeps
 *    `object-fit: cover; object-position: center`, so a quarter-
 *    height card shows the middle slice of the photo.
 *  - The taper is a linear lerp on distance from the viewport
 *    centre, capped one-viewport-height away (cards further than
 *    that are pinned at 0.25).
 *
 * The hook touches the card elements' inline `height` directly:
 *   - On mobile (`max-width: 597px`) it sets a per-row height each
 *     animation frame as the user scrolls.
 *   - On any wider viewport (or when the hook tears down) the
 *     inline height is removed so the page falls back to its
 *     default CSS height (aspect-ratio driven).
 *
 * Both cards in a row share the same target height, computed from
 * the row's first ref.
 */
const FADE_DISTANCE_VH = 1.0; // distance, in viewport heights, over which expansion lerps 1 → MIN_EXPANSION
const MIN_EXPANSION = 0.125;
/** How long the user has to be idle after their last scroll event
 *  before the magnetic snap fires. Long enough that small fingertip
 *  drifts at the end of a flick don't trigger a snap mid-deceleration,
 *  and that a deliberate "just look at this for a second" pause feels
 *  like it earned the auto-centre. */
const SNAP_DEBOUNCE_MS = 1200;
/** Skip snap if the closest row is already this close (in px). Bumped
 *  up so single-pixel fractional offsets that result from rounding in
 *  the smooth-scroll engine don't trigger a follow-up snap. */
const SNAP_TOLERANCE_PX = 6;
/** Window after a programmatic snap during which incoming scroll
 *  events are treated as the snap finishing, not the user scrolling.
 *  Without this guard the smooth-scroll fires scroll events, those
 *  schedule a fresh snap, that snap fires another scroll, and the
 *  page ping-pongs by ±2 rows ad infinitum. */
const PROGRAMMATIC_GUARD_MS = 900;

export function useMobileScrollFocus(
  cardRefs: MutableRefObject<(HTMLLIElement | null)[]>,
  cols: number,
  count: number
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 597px)");

    let raf: number | null = null;
    let snapTimer: number | null = null;
    let programmaticGuardTimer: number | null = null;
    /** Stays false until the user has actually scrolled, so the
     *  initial page-load layout isn't snapped under their feet. */
    let userScrolled = false;
    /** True while a snap-induced smooth-scroll is in flight. Scroll
     *  events fired during this window are still used to update card
     *  heights, but they don't (re)schedule another snap — otherwise
     *  the snap fires forever in a loop. */
    let programmaticScroll = false;

    const reset = () => {
      cardRefs.current.forEach((card) => {
        if (card) card.style.removeProperty("height");
      });
    };

    const update = () => {
      raf = null;
      if (!mq.matches) {
        // Wider viewport — drop our inline heights so the desktop
        // grid layout takes over again.
        reset();
        return;
      }

      const vh = window.innerHeight;
      const center = vh / 2;
      const fadeDistance = vh * FADE_DISTANCE_VH;
      const numRows = Math.ceil(count / cols);

      for (let r = 0; r < numRows; r++) {
        const lead = cardRefs.current[r * cols];
        if (!lead) continue;
        const rect = lead.getBoundingClientRect();
        if (rect.width === 0) continue;

        const rowCenter = rect.top + rect.height / 2;
        const distance = Math.abs(rowCenter - center);
        const normalized = Math.min(1, distance / fadeDistance);
        const expansion = 1 - normalized * (1 - MIN_EXPANSION);
        const fullHeight = (rect.width * 16) / 9;
        const targetHeight = fullHeight * expansion;

        // Apply the same height to every card in this row, so the
        // pair stays visually aligned even though only the lead
        // ref drove the math.
        for (let c = 0; c < cols; c++) {
          const card = cardRefs.current[r * cols + c];
          if (!card) continue;
          card.style.height = `${targetHeight}px`;
        }
      }
    };

    /** Magnetic snap: after the user stops scrolling, find the row
     *  whose centre is closest to viewport centre and smooth-scroll
     *  by the offset so it lands exactly on centre. The smooth
     *  scroll re-fires the scroll listener, which keeps `update`
     *  running, so heights stay in sync as the snap animates. */
    const snap = () => {
      snapTimer = null;
      if (!mq.matches || !userScrolled) return;

      const vh = window.innerHeight;
      const center = vh / 2;
      const numRows = Math.ceil(count / cols);

      let closestDelta: number | null = null;
      for (let r = 0; r < numRows; r++) {
        const lead = cardRefs.current[r * cols];
        if (!lead) continue;
        const rect = lead.getBoundingClientRect();
        if (rect.width === 0) continue;
        const rowCenter = rect.top + rect.height / 2;
        const delta = rowCenter - center;
        if (closestDelta === null || Math.abs(delta) < Math.abs(closestDelta)) {
          closestDelta = delta;
        }
      }

      if (closestDelta === null) return;
      if (Math.abs(closestDelta) < SNAP_TOLERANCE_PX) return;

      // Mark the upcoming smooth-scroll as programmatic so its own
      // scroll events don't re-arm the snap and ping-pong us into the
      // next row.
      programmaticScroll = true;
      if (programmaticGuardTimer !== null) {
        window.clearTimeout(programmaticGuardTimer);
      }
      programmaticGuardTimer = window.setTimeout(() => {
        programmaticScroll = false;
      }, PROGRAMMATIC_GUARD_MS);

      window.scrollBy({ top: closestDelta, behavior: "smooth" });
    };

    const scheduleSnap = () => {
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(snap, SNAP_DEBOUNCE_MS);
    };

    const onScroll = () => {
      // Always keep heights in sync — that's a pure read of viewport
      // geometry and doesn't risk re-firing the snap.
      if (raf === null) raf = requestAnimationFrame(update);
      // Don't (re)schedule a snap on scrolls we caused ourselves —
      // those should ride out without triggering another snap on the
      // tail end.
      if (programmaticScroll) return;
      userScrolled = true;
      scheduleSnap();
    };

    // Run once on mount so the cards land at the correct heights
    // before the user scrolls. No snap on initial load — `userScrolled`
    // gate makes sure the magnet only kicks in after the user has
    // actually moved the page themselves.
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    mq.addEventListener("change", update);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      mq.removeEventListener("change", update);
      if (raf !== null) cancelAnimationFrame(raf);
      if (snapTimer !== null) window.clearTimeout(snapTimer);
      if (programmaticGuardTimer !== null) {
        window.clearTimeout(programmaticGuardTimer);
      }
      reset();
    };
  }, [cardRefs, cols, count]);
}
