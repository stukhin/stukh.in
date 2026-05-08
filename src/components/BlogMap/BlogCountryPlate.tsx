"use client";

import { useEffect, useRef, useState } from "react";
import type { Visit } from "./visits";
import styles from "./BlogCountryPlate.module.css";

export type CountryHoverState = {
  visit: Visit;
};

type Props = {
  hover: CountryHoverState | null;
};

const OFFSET_X = 24;
const OFFSET_Y = 18;

/**
 * Cursor-following info plate that appears while the user is hovering
 * a visited country on the world map. Same direct-DOM-transform
 * approach as WallpaperHoverPlate (no per-frame React renders) — the
 * plate stays glued to the pointer regardless of map parallax.
 *
 * Plate is desktop-only; on tablets / phones the country opens its
 * modal directly on tap, no plate in between.
 */
export default function BlogCountryPlate({ hover }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const positionedRef = useRef(false);
  const [opaque, setOpaque] = useState(false);

  useEffect(() => {
    if (!hover) {
      positionedRef.current = false;
      setOpaque(false);
      return;
    }

    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = `translate3d(${e.clientX + OFFSET_X}px, ${
        e.clientY + OFFSET_Y
      }px, 0)`;
      if (!positionedRef.current) {
        positionedRef.current = true;
        setOpaque(true);
      }
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [hover]);

  if (!hover) return null;
  const { visit } = hover;

  return (
    <div
      ref={ref}
      className={`${styles.plate} ${opaque ? styles.opaque : ""}`}
      aria-hidden="true"
    >
      <div className={styles.head}>
        <span className={styles.name}>{visit.name}</span>
        <span className={styles.flag}>{visit.flag}</span>
      </div>
      <div className={styles.dates}>{visit.dates}</div>
      {visit.cities.length > 0 && (
        <div className={styles.cities}>{visit.cities.join(" · ")}</div>
      )}

      {/* Three 3:4 thumb slots — placeholders until real photo paths
          land in visits.ts. Even when slots are empty the row keeps
          its shape so the plate doesn't reflow when photos arrive. */}
      <div className={styles.thumbs}>
        {[0, 1, 2].map((i) => {
          const src = visit.thumbs[i];
          return (
            <span
              key={i}
              className={styles.thumb}
              style={src ? { backgroundImage: `url(${src})` } : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
