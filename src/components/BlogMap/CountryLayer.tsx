"use client";

import type { MutableRefObject } from "react";
import CountryStroke from "./CountryStroke";
import { explodeStyleFor, type CountryPath } from "./mapProjection";
import styles from "./BlogMap.module.css";

type Props = {
  unvisited: CountryPath[];
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
 *   2. stroke trace (motion.path animating perimeter outline)
 *   3. hit area (transparent, captures pointer events)
 * Unvisited countries render as a single fill layer with no events.
 *
 * The LiquidEther <foreignObject> sits BETWEEN the visual and stroke
 * layers in BlogMap's render — keep that ordering when wiring this
 * layer back into the SVG.
 */
export default function CountryLayer({
  unvisited,
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
      {/* Default world: filled, no stroke, neighbours blur into
          one continent silhouette. In focus mode (.root.focusing
          applied) every unvisited country gets its inline
          explode vector and the CSS rule transforms / fades it
          out. */}
      {unvisited.map((p) => (
        <path
          key={p.id}
          d={p.d}
          className={styles.country}
          style={explodeStyleFor(p.id)}
        >
          <title>{p.name}</title>
        </path>
      ))}

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
            style={isSelected ? undefined : explodeStyleFor(p.id)}
          />
        );
      })}
    </>
  );
}

/**
 * Stroke + hit-area layers for visited countries. Rendered AFTER
 * the LiquidEther foreignObject in BlogMap so the stroke draws over
 * the fluid and the hit area sits on top of everything to catch
 * pointer events.
 */
export function CountryStrokesAndHits({
  visited,
  hoveredIso,
  selectedIso,
  onEnter,
  onLeave,
  onClick,
  visitedPathRefs,
}: Omit<Props, "unvisited" | "visitedSorted">) {
  return (
    <>
      {/* Stroke-trace overlay — one path per visited country,
          always rendered so the motion transition runs between
          states. */}
      {visited.map((p) => {
        const isSelected = selectedIso === p.id;
        return (
          <CountryStroke
            key={`stroke-${p.id}`}
            d={p.d}
            active={hoveredIso === p.id || isSelected}
          />
        );
      })}

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
            style={isSelected ? undefined : explodeStyleFor(p.id)}
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
