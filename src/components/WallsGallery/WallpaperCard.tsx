"use client";

import { MouseEvent, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import type { Wallpaper } from "./WallsGallery";
import styles from "./WallsGallery.module.css";

/** Mirrors the download lifecycle in WallsGallery — kept local to
 *  avoid the parent having to export the union just for prop typing. */
type DownloadState = "idle" | "loading" | "done";

const TILT_AMPLITUDE = 9;
const SPRING = { damping: 30, stiffness: 100, mass: 1.4 };

type CardProps = {
  wallpaper: Wallpaper;
  state: DownloadState;
  isZoomed: boolean;
  onZoom: (w: Wallpaper) => void;
  onDownload: (w: Wallpaper) => void;
  registerImg: (el: HTMLImageElement | null) => void;
  /**
   * Desktop hover-plate hooks. The card forwards mouseenter /
   * mouseleave so the parent can render a frosted plate next to the
   * cursor; the download button has its own enter/leave so the plate
   * can swap to a "format hint" variant when the user is over it.
   */
  onCardEnter?: (w: Wallpaper) => void;
  onCardLeave?: () => void;
  onDownloadEnter?: () => void;
  onDownloadLeave?: () => void;
};

export default function WallpaperCard({
  wallpaper,
  state,
  isZoomed,
  onZoom,
  onDownload,
  registerImg,
  onCardEnter,
  onCardLeave,
  onDownloadEnter,
  onDownloadLeave,
}: CardProps) {
  const ref = useRef<HTMLLIElement>(null);
  const rotateX = useSpring(useMotionValue(0), SPRING);
  const rotateY = useSpring(useMotionValue(0), SPRING);
  const scale = useSpring(1, SPRING);

  function handleMove(e: MouseEvent<HTMLLIElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -TILT_AMPLITUDE);
    rotateY.set((offsetX / (rect.width / 2)) * TILT_AMPLITUDE);
  }

  function handleEnter() {
    scale.set(1.04);
    onCardEnter?.(wallpaper);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
    onCardLeave?.();
  }

  return (
    <motion.li
      ref={(el) => {
        ref.current = el;
      }}
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`${styles.card} ${isZoomed ? styles.cardZoomed : ""}`}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <motion.div
        className={styles.tilt}
        style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }}
      >
        <button
          type="button"
          className={styles.frame}
          onClick={() => onZoom(wallpaper)}
          aria-label={`Open ${wallpaper.title}`}
          data-cursor="magnifier"
        >
          <img
            ref={registerImg}
            src={`/images/walls/${wallpaper.id}_thumb.webp`}
            alt={wallpaper.title}
            className={styles.thumb}
            draggable={false}
          />

          {/* All on-card overlays (chunks, info, specs) were lifted
              out into the cursor-following <WallpaperHoverPlate> on
              desktop — keeps the photo clean and the metadata where
              the eye already is. The loader / saved toast still need
              to render on the card itself because they're per-card
              progress feedback. */}
          {state === "loading" && (
            <span className={styles.loader} aria-hidden="true">
              <span className={styles.bar} />
            </span>
          )}
          {state === "done" && (
            <span className={styles.toast} aria-hidden="true">
              Saved
            </span>
          )}
        </button>

        <button
          type="button"
          className={styles.downloadBtn}
          onClick={() => onDownload(wallpaper)}
          onMouseEnter={onDownloadEnter}
          onMouseLeave={onDownloadLeave}
          disabled={state === "loading"}
          aria-label={`Download ${wallpaper.title}`}
          data-cursor="hover"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M12 4v12" strokeLinecap="round" />
            <path
              d="m6 11 6 6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M5 20h14" strokeLinecap="round" />
          </svg>
        </button>
      </motion.div>
    </motion.li>
  );
}
