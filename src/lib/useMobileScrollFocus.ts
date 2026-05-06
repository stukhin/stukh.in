"use client";

import { MutableRefObject, useEffect } from "react";

/**
 * Mobile-only "focus-on-centre" scroll effect for the Walls grid:
 *
 *  - The two cards in the row whose vertical centre is closest to
 *    the viewport's vertical centre render at their full 9:16
 *    height ("expansion = 1").
 *  - Cards above and below taper smoothly down to half height as
 *    they move away from centre ("expansion = 0.5"). The image
 *    inside keeps `object-fit: cover; object-position: center`, so
 *    a half-height card shows the middle slice of the photo.
 *  - The taper is a linear lerp on distance from the viewport
 *    centre, capped one-viewport-height away (cards further than
 *    that are pinned at 0.5).
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
const FADE_DISTANCE_VH = 1.0; // distance, in viewport heights, over which expansion lerps 1 → 0.5
const MIN_EXPANSION = 0.5;

export function useMobileScrollFocus(
  cardRefs: MutableRefObject<(HTMLLIElement | null)[]>,
  cols: number,
  count: number
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 597px)");

    let raf: number | null = null;

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

    const onScroll = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(update);
    };

    // Run once on mount so the cards land at the correct heights
    // before the user scrolls.
    update();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    mq.addEventListener("change", update);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      mq.removeEventListener("change", update);
      if (raf !== null) cancelAnimationFrame(raf);
      reset();
    };
  }, [cardRefs, cols, count]);
}
