"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PAGE_ORDER, navigateChained } from "./pageOrder";

/**
 * On touch devices, swipe up = next PAGE_ORDER block, swipe down =
 * previous. Lets nature/city flick between strip pages with a finger
 * the same way the desktop's EdgeNav handles top/bottom clicks.
 *
 * Vertical-dominant swipes only (we wait for |dy| to clearly beat
 * |dx|) so the underlying horizontal Swiper inside the gallery
 * still handles slide-to-slide swipes without us interfering.
 */
export function useVerticalPageSwipe() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;

    let start: { x: number; y: number; t: number } | null = null;
    let cancelled = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null;
        cancelled = true;
        return;
      }
      cancelled = false;
      start = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: performance.now(),
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cancelled) return;
      if (e.touches.length !== 1) {
        cancelled = true;
        start = null;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (cancelled || !s) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      const dt = performance.now() - s.t;

      // Vertical-dominant: |dy| at least ~1.5× |dx|.
      if (Math.abs(dy) < Math.abs(dx) * 1.5) return;
      // Minimum distance (in CSS pixels) to count as a real swipe.
      if (Math.abs(dy) < 60) return;
      // Swipe should be reasonably quick — long drags are likely a
      // user trying to inspect the photo, not navigate.
      if (dt > 800) return;

      const idx = PAGE_ORDER.indexOf(pathname);
      if (idx === -1) return;

      if (dy < 0) {
        // Up = next page
        const next = PAGE_ORDER[idx + 1];
        if (!next) return;
        navigateChained(router, pathname, next);
      } else {
        // Down = previous page
        const prev = PAGE_ORDER[idx - 1];
        if (!prev) return;
        navigateChained(router, pathname, prev);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router]);
}
