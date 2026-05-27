"use client";

import type { MutableRefObject } from "react";
import type { CountryPath } from "./mapProjection";
import styles from "./BlogMap.module.css";

type Props = {
  visited: CountryPath[];
  /** `visited` reordered so the currently-hovered country renders
   *  last (SVG paint order = z-index). Caller does the sort. */
  visitedSorted: CountryPath[];
  hoveredIso: string | null;
  selectedIso: string | null;
  onEnter: (iso: string) => void;
  onLeave: () => void;
  onClick: (iso: string) => void;
  /** Live handles to visited hit paths so BlogMap can measure their
   *  bounding rect when entering focus mode. */
  visitedPathRefs: MutableRefObject<Record<string, SVGPathElement | null>>;
};

/**
 * SVG country geometry, painted in three z-stacked layers per
 * visited country:
 *   1. visual fill (colour-only on hover, no scale)
 *   2. stroke trace (WAAPI-driven dashoffset animating perimeter)
 *   3. hit area (transparent, captures pointer events)
 *
 * Unvisited countries are now rendered separately in BlogMap as a
 * single frosted-glass foreignObject clipped to the union of all
 * unvisited paths — no per-path fill here.
 *
 * The LiquidEther <foreignObject> sits BETWEEN the visual and stroke
 * layers in BlogMap's render — keep that ordering when wiring this
 * layer back into the SVG.
 */
export default function CountryLayer({
  visited,
  visitedSorted,
  hoveredIso,
  selectedIso,
  onEnter,
  onLeave,
  onClick,
  visitedPathRefs,
}: Props) {
  return (
    <>
      {/* Visited countries: fill layer. The "active" class is
          applied from React state, not :hover. */}
      {visitedSorted.map((p) => {
        const isActive = hoveredIso === p.id;
        const isSelected = selectedIso === p.id;
        return (
          <path
            key={`visual-${p.id}`}
            d={p.d}
            className={`${styles.visitedVisual} ${
              isActive || isSelected ? styles.visitedVisualActive : ""
            } ${isSelected ? styles.selected : ""}`}
          />
        );
      })}
    </>
  );
}

/**
 * Hit-area layer for visited countries. Rendered AFTER the
 * LiquidEther foreignObject in BlogMap so the hit area sits on
 * top of everything to catch pointer events.
 *
 * (Earlier this also rendered a CountryStroke trace outline on
 * hover; the user asked to remove that animation — the red fill
 * + LiquidEther fluid inside the country are enough hover cue.)
 */
export function CountryStrokesAndHits({
  visited,
  selectedIso,
  onEnter,
  onLeave,
  onClick,
  visitedPathRefs,
}: Omit<Props, "visitedSorted" | "hoveredIso">) {
  return (
    <>
      {/* Hit area on top — captures all mouse events for the
          country. Transparent fill so it stays invisible. The
          parent stashes a live handle so focus-mode entry can
          read the path's screen rect. */}
      {visited.map((p) => {
        const isSelected = selectedIso === p.id;
        return (
          <path
            ref={(el) => {
              visitedPathRefs.current[p.id] = el;
            }}
            key={`hit-${p.id}`}
            d={p.d}
            className={`${styles.visitedHit} ${
              isSelected ? styles.selected : ""
            }`}
            onMouseEnter={() => onEnter(p.id)}
            onMouseLeave={onLeave}
            onClick={() => onClick(p.id)}
            data-cursor="magnifier"
            aria-label={p.name}
          />
        );
      })}
    </>
  );
}
