"use client";

import { MouseEvent, useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import type { Wallpaper } from "./WallsGallery";
import styles from "./WallsGallery.module.css";

/** Mirrors the download lifecycle in WallsGallery — kept local to
 *  avoid the parent having to export the union just for prop typing. */
type DownloadState = "idle" | "loading" | "done";

const TILT_AMPLITUDE = 9;
const SPRING = { damping: 30, stiffness: 100, mass: 1.4 };
/**
 * Off-screen cards render as a lightweight static `<li>` with no
 * springs and no motion machinery; once a card crosses into this
 * margin around the viewport it "upgrades" to the full motion
 * card. 400 px is well outside the visible area on every layout
 * so by the time the user can see the card it's already hover-
 * ready — no visible swap.
 *
 * Without this gate, mounting /walls with 40+ wallpapers spawns
 * 120+ Framer Motion springs (3 per card: rotateX, rotateY,
 * scale). Each spring registers an rAF subscription; on a mid-
 * range Android phone that's measurable scroll jank even for
 * off-screen cards the user never hovers.
 */
const UPGRADE_ROOT_MARGIN = "400px";

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

export default function WallpaperCard(props: CardProps) {
  const liRef = useRef<HTMLLIElement | null>(null);
  const [hasMotion, setHasMotion] = useState(false);

  // One-shot upgrade: as soon as the card crosses the rootMargin we
  // swap to the motion variant and disconnect the observer. We never
  // downgrade — once a card has been seen, the user can scroll back
  // and find it still interactive.
  useEffect(() => {
    if (hasMotion) return;
    const el = liRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setHasMotion(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasMotion(true);
          obs.disconnect();
        }
      },
      { rootMargin: UPGRADE_ROOT_MARGIN }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMotion]);

  if (!hasMotion) {
    return <StaticCard liRef={liRef} {...props} />;
  }
  return <MotionCard liRef={liRef} {...props} />;
}

type InternalProps = CardProps & {
  liRef: React.MutableRefObject<HTMLLIElement | null>;
};

/**
 * Inner content shared between static and motion variants. The hover
 * tilt happens on a parent `<motion.div>` that the motion variant
 * wraps around this; the static variant uses a plain `<div>` so
 * there's no Framer attachment at all.
 */
function InnerContent({
  wallpaper,
  state,
  onZoom,
  onDownload,
  registerImg,
  onDownloadEnter,
  onDownloadLeave,
}: Pick<
  CardProps,
  | "wallpaper"
  | "state"
  | "onZoom"
  | "onDownload"
  | "registerImg"
  | "onDownloadEnter"
  | "onDownloadLeave"
>) {
  return (
    <>
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
    </>
  );
}

/**
 * Pre-upgrade variant. Plain `<li>` + `<div>`, no springs, no
 * Framer Motion. Only job is to (a) reserve grid space (b) expose
 * `liRef` to the IO so the parent can detect when this card
 * crosses into the viewport. The thumb image still loads so the
 * pre-upgrade visual is identical to the upgraded one.
 */
function StaticCard({
  liRef,
  isZoomed,
  ...inner
}: InternalProps) {
  return (
    <li
      ref={liRef}
      className={`${styles.card} ${isZoomed ? styles.cardZoomed : ""}`}
    >
      <div className={styles.tilt}>
        <InnerContent {...inner} />
      </div>
    </li>
  );
}

/**
 * Full motion variant — mounted only after the card crosses the
 * upgrade margin. Three springs drive the 3-D tilt + hover scale.
 */
function MotionCard({
  liRef,
  isZoomed,
  onCardEnter,
  onCardLeave,
  wallpaper,
  ...inner
}: InternalProps) {
  const rotateX = useSpring(useMotionValue(0), SPRING);
  const rotateY = useSpring(useMotionValue(0), SPRING);
  const scale = useSpring(1, SPRING);

  function handleMove(e: MouseEvent<HTMLLIElement>) {
    const el = liRef.current;
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
        liRef.current = el;
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
        <InnerContent wallpaper={wallpaper} {...inner} />
      </motion.div>
    </motion.li>
  );
}
