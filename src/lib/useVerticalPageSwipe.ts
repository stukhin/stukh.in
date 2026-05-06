"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { PAGE_ORDER } from "./pageOrder";
import { pageVisualFor } from "./pageVisuals";

/**
 * Touch-driven vertical paging. As the finger moves, a "preview"
 * overlay of the next / previous PAGE_ORDER block follows the
 * finger's translateY position in real time. On release, if the
 * finger has crossed a threshold the preview animates the rest of
 * the way and the route commits; otherwise it springs back off
 * screen and nothing happens.
 *
 * Replaces the older "swipe + bridge" pattern, which felt
 * disconnected: the user lifted their finger, then ~250ms later a
 * fade-in started and the slide began. Driving the preview from
 * the finger's position closes that gap — the page literally
 * tracks the gesture.
 *
 * Mounted by HomeSlider (on /) and GallerySlider (on /nature, /city).
 * Long-scroll pages (/walls) don't use it, so their normal vertical
 * scroll stays untouched.
 */
const VISUAL_THRESHOLD_PX = 12;
const COMMIT_RATIO = 0.22;
const DOMINANCE = 1.5;

const STYLE_BASE = `
  position: fixed;
  inset: 0;
  z-index: 28;
  pointer-events: none;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  will-change: transform;
`;

export function useVerticalPageSwipe() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;

    let startY = 0;
    let startX = 0;
    let dragging = false;
    let cancelled = false;
    let direction: "next" | "prev" | null = null;
    let preview: HTMLDivElement | null = null;

    const cleanupPreview = () => {
      if (preview && preview.parentNode) {
        preview.parentNode.removeChild(preview);
      }
      preview = null;
    };

    const reset = () => {
      cleanupPreview();
      dragging = false;
      cancelled = false;
      direction = null;
    };

    const targetForDirection = (dir: "next" | "prev"): string | null => {
      const idx = PAGE_ORDER.indexOf(pathname);
      if (idx === -1) return null;
      const tIdx = dir === "next" ? idx + 1 : idx - 1;
      if (tIdx < 0 || tIdx >= PAGE_ORDER.length) return null;
      return PAGE_ORDER[tIdx];
    };

    const createPreview = (target: string): HTMLDivElement => {
      const v = pageVisualFor(target);
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText =
        STYLE_BASE +
        `background-color: ${v.color};` +
        (v.bg ? `background-image: url("${v.bg}");` : "");
      document.body.appendChild(el);
      return el;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        cancelled = true;
        return;
      }
      reset();
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cancelled) return;
      if (e.touches.length !== 1) {
        cancelled = true;
        cleanupPreview();
        return;
      }

      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!dragging) {
        if (Math.abs(dy) < VISUAL_THRESHOLD_PX) return;
        // Direction-of-first-significant-move check: must be vertical-
        // dominant or a horizontal handler (e.g. HomeSlider) takes over.
        if (Math.abs(dy) < Math.abs(dx) * DOMINANCE) {
          cancelled = true;
          return;
        }

        const dir: "next" | "prev" = dy < 0 ? "next" : "prev";
        const target = targetForDirection(dir);
        if (!target) {
          cancelled = true;
          return;
        }

        direction = dir;
        preview = createPreview(target);
        // Park the preview just off-screen on the side the user is
        // pulling it from. `next` (finger moving up) → preview
        // starts below the viewport. `prev` → above.
        preview.style.transform =
          dir === "next" ? "translateY(100%)" : "translateY(-100%)";
        // Force layout commit so the next transform paints as a transition.
        // (Not strictly required since we don't use transitions during
        // the drag, but it's cheap.)
        void preview.offsetHeight;
        dragging = true;
      }

      if (dragging && preview) {
        // Track the finger 1:1. dy is the displacement from where the
        // touch started; the preview's parked offset is ±100%, so the
        // visible translation is the parked offset PLUS dy.
        const offset =
          direction === "next"
            ? `translate3d(0, calc(100% + ${dy}px), 0)`
            : `translate3d(0, calc(-100% + ${dy}px), 0)`;
        preview.style.transform = offset;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!dragging || !preview || !direction) {
        reset();
        return;
      }

      const touch = e.changedTouches[0];
      const dy = touch.clientY - startY;
      const threshold = window.innerHeight * COMMIT_RATIO;
      const commit = Math.abs(dy) > threshold;
      const target = targetForDirection(direction);

      if (commit && target) {
        // Animate preview into place, then push the route. The preview
        // remains until just after the route commits so the new page
        // has a frame to render behind it.
        preview.style.transition =
          "transform 0.32s cubic-bezier(0.45, 0, 0.25, 1)";
        preview.style.transform = "translate3d(0, 0, 0)";

        const commitDir = direction;
        window.setTimeout(() => {
          router.push(target);
          // Drop the preview shortly after — by then React has rendered
          // the new page underneath. If we drop too early the user sees
          // a flash of the OLD page; too late and the new page can't
          // settle its first paint.
          window.setTimeout(() => {
            cleanupPreview();
          }, 80);
        }, 320);

        // Clear local state so a follow-up gesture during the commit
        // animation doesn't try to drive the same preview.
        dragging = false;
        direction = null;
        preview = null;
        cancelled = true;
        // commitDir is captured by the timeout's closure; not needed
        // outside.
        void commitDir;
        return;
      }

      // Bounce-back: animate to off-screen, then remove.
      const dir = direction;
      preview.style.transition = "transform 0.24s ease-out";
      preview.style.transform =
        dir === "next" ? "translate3d(0, 100%, 0)" : "translate3d(0, -100%, 0)";
      const dyingPreview = preview;
      preview = null;
      dragging = false;
      direction = null;
      window.setTimeout(() => {
        if (dyingPreview.parentNode) {
          dyingPreview.parentNode.removeChild(dyingPreview);
        }
      }, 250);
    };

    const onTouchCancel = () => {
      reset();
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
      cleanupPreview();
    };
  }, [pathname, router]);
}
