"use client";

import type { CountryPath } from "./mapProjection";
import styles from "./BlogMap.module.css";

type VisualProps = {
  /** Visited countries reordered so the currently-hovered one renders
   *  last (SVG paint order = z-index). Caller does the sort. */
  visitedSorted: CountryPath[];
  hoveredIso: string | null;
  selectedIso: string | null;
};

type HitProps = {
  visited: CountryPath[];
  selectedIso: string | null;
  onEnter: (iso: string) => void;
  onLeave: () => void;
  onClick: (iso: string) => void;
};

/**
 * SVG country geometry for visited countries, painted in two
 * z-stacked layers:
 *   1. visual fill (colour-only on hover, no scale) — this component
 *   2. hit area (transparent, captures pointer events) —
 *      CountryStrokesAndHits below
 *
 * Unvisited countries are rendered separately in BlogMap as a
 * single frosted-glass foreignObject clipped to the union of all
 * unvisited paths — no per-path fill here.
 *
 * The LiquidEther <foreignObject> sits BETWEEN the two layers in
 * BlogMap's render — keep that ordering when wiring them into the
 * SVG.
 */
export default function CountryLayer({
  visitedSorted,
  hoveredIso,
  selectedIso,
}: VisualProps) {
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
}: HitProps) {
  return (
    <>
      {/* Hit area on top — captures all mouse events for the
          country. Transparent fill so it stays invisible. */}
      {visited.map((p) => {
        const isSelected = selectedIso === p.id;
        return (
          <path
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
