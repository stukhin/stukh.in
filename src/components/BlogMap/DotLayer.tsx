"use client";

import styles from "./BlogMap.module.css";

export type DotMarker = {
  iso: string;
  name: string;
  x: number;
  y: number;
};

type Props = {
  dotMarkers: DotMarker[];
  hoveredIso: string | null;
  selectedIso: string | null;
  onEnter: (iso: string) => void;
  onLeave: () => void;
  onClick: (iso: string) => void;
};

/**
 * Visual fill layer for dot-style visits (small islands the
 * TopoJSON polygon barely registers, plus pin-style "I was here"
 * markers in the future). Tiny filled circle at the projected
 * lat/long; the matching hit area lives in <DotHits> below.
 */
export default function DotLayer({
  dotMarkers,
  hoveredIso,
  selectedIso,
}: Pick<Props, "dotMarkers" | "hoveredIso" | "selectedIso">) {
  return (
    <>
      {dotMarkers.map((m) => {
        const isActive = hoveredIso === m.iso;
        const isSelected = selectedIso === m.iso;
        return (
          <circle
            key={`dot-visual-${m.iso}`}
            cx={m.x}
            cy={m.y}
            r={2.6}
            className={`${styles.visitedDot} ${
              isActive || isSelected ? styles.visitedDotActive : ""
            } ${isSelected ? styles.selected : ""}`}
          />
        );
      })}
    </>
  );
}

/**
 * Hit areas for the dot markers — bigger transparent circle around
 * the visible 2.6r dot so the cursor can actually land on it. Has
 * to render LAST in the SVG so it sits above the LiquidEther
 * foreignObject and catches pointer events.
 */
export function DotHits({
  dotMarkers,
  selectedIso,
  onEnter,
  onLeave,
  onClick,
}: Omit<Props, "hoveredIso">) {
  return (
    <>
      {dotMarkers.map((m) => {
        const isSelected = selectedIso === m.iso;
        return (
          <circle
            key={`dot-hit-${m.iso}`}
            cx={m.x}
            cy={m.y}
            r={14}
            className={`${styles.visitedDotHit} ${
              isSelected ? styles.selected : ""
            }`}
            onMouseEnter={() => onEnter(m.iso)}
            onMouseLeave={onLeave}
            onClick={() => onClick(m.iso)}
            data-cursor="magnifier"
            aria-label={m.name}
          />
        );
      })}
    </>
  );
}
