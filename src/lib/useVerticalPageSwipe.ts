"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { MQ, useMediaQuery } from "./useMediaQuery";
import { PAGE_ORDER, navigateChained } from "./pageOrder";

/**
 * Mobile counterpart to useDesktopPageWheel. A single-finger vertical
 * swipe past a threshold triggers a chained navigation to the next
 * (swipe up) or previous (swipe down) page in PAGE_ORDER. Mirrors
 * the desktop wheel UX: the threshold-crossing event is the entire
 * signal — there is no live finger-tracking preview. Commit hands
 * off to ChainBridge, which paints the same slide animation that a
 * desktop wheel-nav uses.
 *
 * Mounted by HomeSlider (/) and GallerySlider (/nature, /city).
 * Long-scroll pages (/walls) don't use it so their native scroll
 * stays. /blog hosts the map's own touch handlers; vertical paging
 * out of /blog goes through EdgeNav.
 */
const COMMIT_RATIO = 0.22;
const DOMINANCE = 1.5;
const FIRST_MOVE_PX = 8;
const COOLDOWN_MS = 1200;

export function useVerticalPageSwipe() {
  const router = useRouter();
  const pathname = usePathname();
  // (hover: none) AND (pointer: coarse) so a Windows touchscreen
  // laptop that reports both fine pointer (the trackpad) and touch
  // (the screen) doesn't get this gesture handler in addition to
  // useDesktopPageWheel — without the coarse gate both would fire
  // on the same gesture.
  const isTouch =
    useMediaQuery(MQ.TOUCH) && useMediaQuery("(pointer: coarse)");

  useEffect(() => {
    if (!isTouch) return;

    let startY = 0;
    let startX = 0;
    let tracking = false;
    let cancelled = false;
    let directionLocked = false;
    let cooldownUntil = 0;

    const targetForDelta = (dy: number): string | null => {
      const idx = PAGE_ORDER.indexOf(pathname);
      if (idx === -1) return null;
      const tIdx = dy < 0 ? idx + 1 : idx - 1;
      if (tIdx < 0 || tIdx >= PAGE_ORDER.length) return null;
      return PAGE_ORDER[tIdx];
    };

    const onTouchStart = (e: TouchEvent) => {
      if (Date.now() < cooldownUntil) {
        cancelled = true;
        return;
      }
      if (e.touches.length !== 1) {
        cancelled = true;
        return;
      }
      tracking = true;
      cancelled = false;
      directionLocked = false;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking || cancelled) return;
      if (e.touches.length !== 1) {
        cancelled = true;
        return;
      }
      if (directionLocked) return;

      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      if (Math.abs(dy) < FIRST_MOVE_PX && Math.abs(dx) < FIRST_MOVE_PX) {
        return;
      }
      // Direction-of-first-significant-move: vertical-dominant or the
      // horizontal handler (HomeSlider's swiper, gallery swipe) owns
      // the rest of the gesture.
      if (Math.abs(dy) < Math.abs(dx) * DOMINANCE) {
        cancelled = true;
        return;
      }
      directionLocked = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const wasTracking = tracking;
      tracking = false;
      if (!wasTracking || cancelled) {
        cancelled = false;
        return;
      }
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dy = touch.clientY - startY;
      const threshold = window.innerHeight * COMMIT_RATIO;
      if (Math.abs(dy) < threshold) return;

      const target = targetForDelta(dy);
      if (!target) return;
      cooldownUntil = Date.now() + COOLDOWN_MS;
      navigateChained(router, pathname, target);
    };

    const onTouchCancel = () => {
      tracking = false;
      cancelled = false;
      directionLocked = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [pathname, router, isTouch]);
}
