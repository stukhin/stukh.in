"use client";

import { useEffect } from "react";
import { MQ, useMediaQuery } from "./useMediaQuery";

/**
 * Lightweight smooth-scroll wrapper for routes whose body scrolls
 * (currently /walls). Hijacks the wheel event and tweens
 * window.scrollY toward a target each rAF, giving the inertial /
 * "premium feel" the user asked for without pulling in Lenis or
 * another runtime dependency.
 *
 * The implementation deliberately RELEASES wheel events when the
 * gesture would push past the document edge in its scroll direction,
 * so the existing useDesktopPageWheel gate still gets clean events
 * to count toward the page-nav threshold (scroll past bottom →
 * /blog, scroll past top → /city). Without that release the
 * preventDefault'd wheel events would mark the gesture consumed and
 * page-nav would never fire.
 *
 *  - Touch devices skipped: the OS already provides smooth inertial
 *    scroll there and intercepting wheel events does nothing.
 *  - Reduced-motion preference honoured: caller can opt out with
 *    `enabled = false`; we also bail when matchMedia reports the
 *    preference.
 */
type Options = {
  /**
   * Smoothing factor per frame (0 < lerp <= 1). Higher = snappier;
   * lower = more inertia. 0.12 reads as "premium but not laggy".
   */
  lerp?: number;
};

export function useSmoothScroll({ lerp = 0.12 }: Options = {}) {
  const isTouch = useMediaQuery(MQ.TOUCH);
  const reducedMotion = useMediaQuery(MQ.REDUCED_MOTION);
  useEffect(() => {
    if (isTouch || reducedMotion) return;

    let target = window.scrollY;
    let current = window.scrollY;
    let raf: number | null = null;

    const tick = () => {
      const diff = target - current;
      if (Math.abs(diff) < 0.5) {
        current = target;
        window.scrollTo(0, current);
        raf = null;
        return;
      }
      current += diff * lerp;
      window.scrollTo(0, current);
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      const html = document.documentElement;
      const max = html.scrollHeight - html.clientHeight;
      if (max <= 0) return;

      const goingDown = e.deltaY > 0;
      // Compare against the LIVE target (not currentScroll) so a
      // chain of fast wheel events near the edge correctly registers
      // as "we're past the edge in our gesture's direction" even
      // before the eased current catches up.
      const atTop = target <= 0.5;
      const atBottom = target >= max - 0.5;
      const atEdgeInDir = (goingDown && atBottom) || (!goingDown && atTop);
      // At the edge in the wheel direction: don't intercept, let
      // the event reach useDesktopPageWheel so a fresh gesture can
      // page to the next/previous route.
      if (atEdgeInDir) return;

      e.preventDefault();
      target = Math.max(0, Math.min(max, target + e.deltaY));
      if (raf === null) raf = requestAnimationFrame(tick);
    };

    // Keep `target` in sync if scroll is driven externally
    // (e.g. anchor jump, browser restore, touch device fallback).
    const onScroll = () => {
      if (raf === null) {
        target = window.scrollY;
        current = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [lerp, isTouch, reducedMotion]);
}
