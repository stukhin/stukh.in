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
 * Gesture gate: a single trackpad / wheel gesture cannot both scroll
 * page content (or zoom the blog map) AND fire a page-nav. If any
 * wheel event in the current gesture either scrolled the document or
 * was preventDefault'd by an in-page handler (e.g. BlogMap's zoom),
 * the rest of that gesture is ignored for nav purposes. A new gesture
 * begins after GESTURE_GAP_MS of wheel silence; only then can the
 * accumulator start and a deliberate second swipe trigger nav. This
 * gives /walls (scroll to bottom → stop, then a fresh swipe pages
 * down) and /blog (zoom map → stop, then a fresh swipe pages) the
 * "two-step" feel the user asked for.
 *
 *  - On non-scrollable pages (/, /nature, /city) a fresh gesture
 *    accumulates immediately.
 *  - On scrollable pages (/walls) the gesture must START at the top
 *    or bottom of the document — if it begins anywhere mid-page it's
 *    considered a content-scroll gesture and never fires nav.
 *  - On /blog the map's wheel handler preventDefaults zoom events;
 *    those mark the gesture consumed. Once at zoom limit BlogMap
 *    stops preventDefault'ing (see its onWheel) so a fresh gesture
 *    after the user lifts their fingers can navigate.
 *  - 600px threshold so the gesture has to feel deliberate.
 *  - 2.5s cooldown covers the chain animation + a beat of idle, so
 *    trackpad coast can't sneak through.
 */

const THRESHOLD = 600;
const COOLDOWN_MS = 2500;
const RESET_MS = 240;
const GESTURE_GAP_MS = 220;

export function useDesktopPageWheel() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const cooldownUntilRef = useRef(0);
  const accumRef = useRef(0);
  const lastWheelTsRef = useRef(0);
  /**
   * `true` when the current gesture has either scrolled page content
   * or been consumed by an in-page wheel handler (BlogMap zoom).
   * Stays true for the rest of the gesture so its inertial tail
   * can't sneak a nav through. Reset to false at the next gesture
   * boundary (>GESTURE_GAP_MS of silence).
   */
  const gestureConsumedRef = useRef(false);

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
      const now = Date.now();
      // Trackpad inertia keeps firing for a while after the cooldown
      // started — we still need to update lastWheelTsRef so the gap
      // detection below sees the true silence-window after inertia
      // decays.
      if (now < cooldownUntilRef.current) {
        lastWheelTsRef.current = now;
        return;
      }
      if (document.documentElement.classList.contains("zoom-open")) return;
      const path = pathnameRef.current;
      if (PAGE_ORDER.indexOf(path) === -1) return;

      const isNewGesture = now - lastWheelTsRef.current > GESTURE_GAP_MS;
      lastWheelTsRef.current = now;
      if (isNewGesture) {
        gestureConsumedRef.current = false;
        accumRef.current = 0;
      }

      // In-page handler took the event (e.g. BlogMap zoom). Mark the
      // gesture consumed so its inertial tail can't fire a page nav,
      // and bail without accumulating.
      if (e.defaultPrevented) {
        gestureConsumedRef.current = true;
        return;
      }

      const html = document.documentElement;
      const canScroll = html.scrollHeight > html.clientHeight + 1;
      if (canScroll) {
        const goingDown = e.deltaY > 0;
        const atTop = window.scrollY <= 1;
        const atBottom =
          Math.ceil(window.scrollY + html.clientHeight) >=
          html.scrollHeight - 1;
        const atEdgeInDir =
          (goingDown && atBottom) || (!goingDown && atTop);
        if (!atEdgeInDir) {
          // Page is scrolling its own content. Mark the gesture
          // consumed so the same gesture's tail (which may continue
          // hitting the edge) doesn't accumulate into a nav.
          gestureConsumedRef.current = true;
          accumRef.current = 0;
          return;
        }
      }

      // Gesture is either fresh-at-edge or non-scrollable: accumulate
      // — unless this gesture has already consumed scroll / zoom, in
      // which case the user needs a fresh gesture to nav.
      if (gestureConsumedRef.current) return;

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
