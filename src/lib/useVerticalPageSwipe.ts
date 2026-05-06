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
 * Mounted by HomeSlider (on /) and GallerySlider (on /nature, /city).
 * Long-scroll pages (/walls) don't use it, so their normal vertical
 * scroll stays untouched.
 */
const VISUAL_THRESHOLD_PX = 12;
const COMMIT_RATIO = 0.22;
const DOMINANCE = 1.5;
const COMMIT_ANIM_MS = 320;
const BOUNCE_ANIM_MS = 240;

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
    /** True between touchend (commit) and the cleanup of its preview.
     *  While set, fresh touch sequences are ignored so the user can't
     *  start a second drag mid-flight. */
    let committing = false;
    let direction: "next" | "prev" | null = null;
    let preview: HTMLDivElement | null = null;

    const removeEl = (el: HTMLDivElement | null) => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
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
      // While a previous commit's preview is still on screen we
      // ignore new touches; otherwise we end up with two previews.
      if (committing) {
        cancelled = true;
        return;
      }
      if (e.touches.length !== 1) {
        cancelled = true;
        return;
      }
      // Reset any leftover state. Note: this also cleans up an idle
      // preview if one's still mounted (it shouldn't be, but defensive).
      removeEl(preview);
      preview = null;
      dragging = false;
      direction = null;
      cancelled = false;

      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (cancelled || committing) return;
      if (e.touches.length !== 1) {
        cancelled = true;
        removeEl(preview);
        preview = null;
        dragging = false;
        direction = null;
        return;
      }

      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!dragging) {
        if (Math.abs(dy) < VISUAL_THRESHOLD_PX) return;
        // Direction-of-first-significant-move check: must be vertical-
        // dominant or the horizontal handler (e.g. HomeSlider) takes
        // over.
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
        // Park preview just off-screen on the side the user is pulling
        // it from. `next` (finger moving up) → starts below the
        // viewport. `prev` → above.
        preview.style.transform =
          dir === "next" ? "translate3d(0, 100%, 0)" : "translate3d(0, -100%, 0)";
        // Force the parked transform to commit before any subsequent
        // updates so the user's first frame always sees the parked
        // state, not a flash at translateY(0).
        void preview.offsetHeight;
        dragging = true;
      }

      if (dragging && preview) {
        // 1:1 finger tracking. Parked offset is ±100% (off-screen);
        // the displacement adds dy on top so the preview's edge tracks
        // exactly where the finger was when it crossed the start
        // point.
        const offset =
          direction === "next"
            ? `translate3d(0, calc(100% + ${dy}px), 0)`
            : `translate3d(0, calc(-100% + ${dy}px), 0)`;
        preview.style.transform = offset;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (committing) return;
      if (!dragging || !preview || !direction) {
        removeEl(preview);
        preview = null;
        dragging = false;
        direction = null;
        cancelled = false;
        return;
      }

      const touch = e.changedTouches[0];
      const dy = touch.clientY - startY;
      const threshold = window.innerHeight * COMMIT_RATIO;
      const commit = Math.abs(dy) > threshold;
      const target = targetForDirection(direction);

      if (commit && target) {
        // Capture the live preview into a local — once we null
        // `preview`, only this local closure holds the DOM ref, so
        // the cleanup timeout can still find and remove it.
        const live = preview;
        live.style.transition = `transform ${COMMIT_ANIM_MS}ms cubic-bezier(0.45, 0, 0.25, 1)`;
        live.style.transform = "translate3d(0, 0, 0)";

        committing = true;
        preview = null;
        dragging = false;
        direction = null;

        // Push the route immediately — the destination page mounts
        // behind the still-animating preview, so by the time the
        // preview is removed the new page is already painted.
        router.push(target);

        window.setTimeout(() => {
          removeEl(live);
          committing = false;
        }, COMMIT_ANIM_MS + 40);
        return;
      }

      // Bounce-back: animate the preview off-screen, then remove.
      const dyingPreview = preview;
      const dyingDir = direction;
      preview = null;
      dragging = false;
      direction = null;
      dyingPreview.style.transition = `transform ${BOUNCE_ANIM_MS}ms ease-out`;
      dyingPreview.style.transform =
        dyingDir === "next"
          ? "translate3d(0, 100%, 0)"
          : "translate3d(0, -100%, 0)";
      window.setTimeout(() => {
        removeEl(dyingPreview);
      }, BOUNCE_ANIM_MS + 20);
    };

    const onTouchCancel = () => {
      removeEl(preview);
      preview = null;
      dragging = false;
      direction = null;
      cancelled = false;
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
      // Clear any preview still attached. A preview owned by a still-
      // pending commit timeout (committing=true) lives in the
      // setTimeout's closure as `live`; it removes itself when the
      // timer fires.
      removeEl(preview);
      preview = null;
    };
  }, [pathname, router]);
}
