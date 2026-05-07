"use client";

import { useState } from "react";
import styles from "./BlogMap.module.css";

/**
 * Placeholder marker — eventually each visited country will hover-
 * open a small card with thumbnail + a one-line note. For now the
 * coordinates are rough (eyeballed against the simplified continent
 * sketch below) and only the label is wired to the hover state, just
 * so the feel of the eventual interaction is testable.
 */
type Visit = {
  id: string;
  /** SVG x in 0..200 (matches viewBox below). */
  x: number;
  /** SVG y in 0..100. */
  y: number;
  label: string;
};

const VISITS: Visit[] = [
  { id: "es", x: 92, y: 30, label: "spain" },
  { id: "pt", x: 88, y: 32, label: "portugal" },
  { id: "is", x: 88, y: 14, label: "iceland" },
  { id: "no", x: 102, y: 14, label: "norway" },
  { id: "ge", x: 122, y: 28, label: "georgia" },
  { id: "ae", x: 130, y: 38, label: "uae" },
  { id: "in", x: 142, y: 40, label: "india" },
  { id: "id", x: 162, y: 56, label: "indonesia" },
  { id: "us", x: 36, y: 30, label: "usa" },
];

/**
 * Hand-rolled simplified world map. The continent paths are very
 * rough on purpose — this lives on /blog as a placeholder for the
 * eventual interactive "where I've been + photos / recommendations"
 * map, and a sketched feel suits an under-construction banner more
 * than a precise vector would.
 *
 * viewBox is 200 × 100 (≈ Mercator aspect). All coordinates below
 * fit inside that, so the map scales cleanly with the container.
 */
export default function BlogMap() {
  const [hover, setHover] = useState<Visit | null>(null);

  return (
    <div className={styles.mapWrap}>
      <svg
        viewBox="0 0 200 100"
        className={styles.map}
        preserveAspectRatio="xMidYMid meet"
        aria-label="World map of visited places"
      >
        {/* Faint graticule — a couple of horizontal lines to suggest
            "this is a world map" without being noisy. */}
        <g className={styles.grid}>
          <line x1="0" y1="20" x2="200" y2="20" />
          <line x1="0" y1="50" x2="200" y2="50" />
          <line x1="0" y1="80" x2="200" y2="80" />
          <line x1="50" y1="0" x2="50" y2="100" />
          <line x1="100" y1="0" x2="100" y2="100" />
          <line x1="150" y1="0" x2="150" y2="100" />
        </g>

        {/* Continent silhouettes. These are intentionally rough — see
            the docblock above. */}
        <g className={styles.continents}>
          {/* North America */}
          <path d="M16 22 L22 14 L34 12 L46 11 L54 14 L58 20 L57 28 L52 34 L48 40 L43 45 L37 48 L30 46 L24 40 L18 32 Z" />
          {/* Greenland */}
          <path d="M62 8 L70 6 L74 12 L72 18 L66 18 Z" />
          {/* South America */}
          <path d="M48 54 L56 48 L60 52 L62 58 L60 68 L56 76 L52 82 L46 78 L43 70 L44 62 Z" />
          {/* Europe */}
          <path d="M88 18 L102 16 L114 22 L110 28 L104 30 L98 28 L92 26 Z" />
          {/* Africa */}
          <path d="M94 36 L108 34 L116 38 L120 46 L118 56 L112 66 L106 72 L100 74 L94 70 L90 62 L88 52 L90 44 Z" />
          {/* Asia */}
          <path d="M112 14 L130 10 L150 12 L168 16 L180 20 L178 28 L170 34 L160 36 L150 34 L138 30 L128 28 L118 26 L114 22 Z" />
          {/* India */}
          <path d="M138 32 L146 34 L148 42 L142 46 L138 42 Z" />
          {/* SE Asia / Indonesia */}
          <path d="M156 50 L172 48 L180 54 L176 60 L168 60 L160 58 Z" />
          {/* Australia */}
          <path d="M160 70 L176 68 L184 72 L186 78 L180 84 L170 84 L162 80 L158 76 Z" />
          {/* New Zealand */}
          <path d="M186 84 L190 84 L190 88 L186 88 Z" />
          {/* British Isles */}
          <path d="M86 22 L90 22 L90 26 L86 26 Z" />
          {/* Japan */}
          <path d="M178 24 L182 26 L182 30 L178 30 Z" />
        </g>

        {/* Visited markers — small filled discs with a soft halo when
            hovered. */}
        <g className={styles.visits}>
          {VISITS.map((v) => (
            <g
              key={v.id}
              transform={`translate(${v.x} ${v.y})`}
              onMouseEnter={() => setHover(v)}
              onMouseLeave={() => setHover((h) => (h?.id === v.id ? null : h))}
              data-cursor="hover"
            >
              <circle r="2.4" className={styles.visitHalo} />
              <circle r="1.1" className={styles.visitDot} />
            </g>
          ))}
        </g>
      </svg>

      {/* Hover label — positions itself in the corner of the map for
          now (proper anchored tooltips can come with the real photo
          previews). */}
      <div
        className={`${styles.label} ${hover ? styles.labelVisible : ""}`}
        aria-live="polite"
      >
        {hover?.label ?? ""}
      </div>

      <div className={styles.stamp}>under construction</div>
    </div>
  );
}
