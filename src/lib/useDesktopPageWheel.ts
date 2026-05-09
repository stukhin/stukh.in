"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PAGE_ORDER, navigateChained } from "./pageOrder";

/**
 * Desktop counterpart to useVerticalPageSwipe. Listens for sustained
 * vertical wheel scrolling and triggers a chained navigation to the
 * next/previous page in PAGE_ORDER once the accumulator crosses a
 * threshold — same idea as the mobile finger-drag, but driven by
 * wheel / trackpad delta.
 *
 * Behaviour:
 *  - On non-scrollable pages (/, /nature, /city, /blog) every wheel
 *    event accumulates immediately.
 *  - On scrollable pages (/walls) the accumulator only kicks in once
 *    the user has reached the top or bottom of the document AND
 *    keeps scrolling in that direction — so they can browse the
 *    grid normally first, then "pull through" to the next page.
 *  - Cooldown after each navigation prevents inertia from a
 *    trackpad pushing the user multiple pages forward in one fling.
 *  - Defers to in-page wheel handlers (e.g. /blog map zoom, /walls
 *    horizontal-scroll filter row) by skipping events that were
 *    already preventDefault'd.
 */

/** Pixels of accumulated wheel delta before we commit to a nav. */
const THRESHOLD = 320;
/** No new nav fires for this many ms after one has fired. */
const COOLDOWN_MS = 1200;
/** Idle window after which the accumulator resets to 0. */
const RESET_MS = 220;

export function useDesktopPageWheel() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Touch devices already have useVerticalPageSwipe; the wheel
    // path here is desktop-only.
    if (window.matchMedia("(hover: none)").matches) return;
    if (PAGE_ORDER.indexOf(pathname) === -1) return;

    let accum = 0;
    let resetTimer: number | null = null;
    let cooldown = false;

    const fire = (toIdx: number) => {
      const fromIdx = PAGE_ORDER.indexOf(pathname);
      if (toIdx < 0 || toIdx >= PAGE_ORDER.length) return;
      if (toIdx === fromIdx) return;
      const target = PAGE_ORDER[toIdx];
      cooldown = true;
      navigateChained(router, pathname, target);
      window.setTimeout(() => {
        cooldown = false;
      }, COOLDOWN_MS);
    };

    const onWheel = (e: WheelEvent) => {
      if (cooldown) return;
      // Some other handler claimed this event — e.g. the blog map's
      // wheel-zoom or the walls dropdown's intercepted scroll.
      if (e.defaultPrevented) return;
      // Don't fire during a modal session (galleries / walls zoom).
      if (document.documentElement.classList.contains("zoom-open")) return;

      // Native scroll boundary check. If the document scrolls
      // vertically and we're not yet at the boundary in the wheel
      // direction, let the browser handle the scroll and reset the
      // accumulator. Only when we've hit the boundary do we start
      // building toward a nav.
      const html = document.documentElement;
      const canScroll = html.scrollHeight > html.clientHeight + 1;
      if (canScroll) {
        const goingDown = e.deltaY > 0;
        const atTop = window.scrollY <= 1;
        const atBottom =
          Math.ceil(window.scrollY + html.clientHeight) >=
          html.scrollHeight - 1;
        if (goingDown && !atBottom) {
          accum = 0;
          return;
        }
        if (!goingDown && !atTop) {
          accum = 0;
          return;
        }
      }

      accum += e.deltaY;
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accum = 0;
      }, RESET_MS);

      const fromIdx = PAGE_ORDER.indexOf(pathname);
      if (accum > THRESHOLD) {
        fire(fromIdx + 1);
        accum = 0;
      } else if (accum < -THRESHOLD) {
        fire(fromIdx - 1);
        accum = 0;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, [pathname, router]);
}
