"use client";

import { useEffect, useRef, useState } from "react";
import type { Wallpaper } from "./WallsGallery";
import styles from "./WallpaperHoverPlate.module.css";

export type HoverState = {
  wallpaper: Wallpaper;
  isHoveringDownload: boolean;
};

type Props = {
  hover: HoverState | null;
};

const OFFSET_X = 22;
const OFFSET_Y = 16;

/**
 * Frosted-glass tooltip-style plate that floats next to the cursor
 * while the user is hovering a Walls card on desktop. Position is
 * driven by a window mousemove listener that writes directly to the
 * element's transform — no per-frame React re-render — so the plate
 * stays perfectly stuck to the pointer even on busy pages.
 *
 * Content varies with where the mouse is inside the card:
 *   - on the photo (anywhere except the download icon): title +
 *     "location · year"
 *   - on the download icon: same, plus a "1080×1920 · jpg" line
 *     hinting at what's about to land in the user's downloads folder
 *
 * Hidden on touch / tablet — the cards there have their own
 * full-bleed treatment and there's no cursor to hang the plate off.
 */
export default function WallpaperHoverPlate({ hover }: Props) {
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
  const { wallpaper, isHoveringDownload } = hover;

  return (
    <div
      ref={ref}
      className={`${styles.plate} ${opaque ? styles.opaque : ""}`}
      aria-hidden="true"
    >
      <div className={styles.title}>{wallpaper.title}</div>
      <div className={styles.meta}>
        {wallpaper.location} · {wallpaper.year}
      </div>
      {isHoveringDownload && (
        <div className={styles.format}>1080×1920 · jpg</div>
      )}
    </div>
  );
}
