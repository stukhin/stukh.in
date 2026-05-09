"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PAGE_ORDER, navigateChained } from "./pageOrder";

/**
 * Desktop counterpart to useVerticalPageSwipe. Listens for sustained
 * vertical wheel scrolling and triggers a chained navigation to the
 * next/previous page in PAGE_ORDER once the accumulator crosses a
 * threshold — same idea as the mobile finger-drag, but driven by
 * wheel / trackpad delta.
 *
 * Important state lives in refs (cooldownUntilRef, accumRef) so it
 * survives effect re-runs when pathname changes after a navigation.
 * Without the ref, the effect was recreated on every nav, the new
 * effect started with cooldown=false, and trackpad inertia from the
 * tail of the user's gesture could fire a second nav before they
 * meant to — that's the "two pages skipped at once" bug.
 *
 *  - On non-scrollable pages (/, /nature, /city, /blog) every wheel
 *    event accumulates immediately.
 *  - On scrollable pages (/walls) the accumulator only kicks in once
 *    the user has reached the top or bottom of the document AND
 *    keeps scrolling in that direction.
 *  - 600px threshold (was 320) so the gesture has to feel deliberate.
 *  - 2.5s cooldown (was 1.2s) covers the chain animation + a beat
 *    of idle, so trackpad coast can't sneak through.
 *  - Defers to in-page wheel handlers (e.g. /blog map zoom) by
 *    skipping events that were already preventDefault'd.
 */

const THRESHOLD = 600;
const COOLDOWN_MS = 2500;
const RESET_MS = 240;

export function useDesktopPageWheel() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const cooldownUntilRef = useRef(0);
  const accumRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;

    let resetTimer: number | null = null;

    const fire = (toIdx: number) => {
      const path = pathnameRef.current;
      const fromIdx = PAGE_ORDER.indexOf(path);
      if (fromIdx === -1) return;
      if (toIdx < 0 || toIdx >= PAGE_ORDER.length) return;
      if (toIdx === fromIdx) return;
      const target = PAGE_ORDER[toIdx];
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      accumRef.current = 0;
      navigateChained(router, path, target);
    };

    const onWheel = (e: WheelEvent) => {
      if (Date.now() < cooldownUntilRef.current) return;
      if (e.defaultPrevented) return;
      if (document.documentElement.classList.contains("zoom-open")) return;
      const path = pathnameRef.current;
      if (PAGE_ORDER.indexOf(path) === -1) return;

      const html = document.documentElement;
      const canScroll = html.scrollHeight > html.clientHeight + 1;
      if (canScroll) {
        const goingDown = e.deltaY > 0;
        const atTop = window.scrollY <= 1;
        const atBottom =
          Math.ceil(window.scrollY + html.clientHeight) >=
          html.scrollHeight - 1;
        if (goingDown && !atBottom) {
          accumRef.current = 0;
          return;
        }
        if (!goingDown && !atTop) {
          accumRef.current = 0;
          return;
        }
      }

      accumRef.current += e.deltaY;
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accumRef.current = 0;
      }, RESET_MS);

      const fromIdx = PAGE_ORDER.indexOf(pathnameRef.current);
      if (accumRef.current > THRESHOLD) {
        fire(fromIdx + 1);
      } else if (accumRef.current < -THRESHOLD) {
        fire(fromIdx - 1);
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      if (resetTimer !== null) window.clearTimeout(resetTimer);
    };
  }, [router]);
}
