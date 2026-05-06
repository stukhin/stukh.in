"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_ORDER } from "@/lib/pageOrder";
import styles from "./ChainBridge.module.css";

/**
 * Each entry in PAGE_ORDER gets a "stand-in" visual the bridge can
 * scroll through — full-bleed background image where the real page
 * has one (nature, city, /), or the page's own dark base colour
 * (walls, trips). The bridge isn't pixel-perfect with the real page,
 * but it's close enough that the user reads it as one continuous
 * scroll across the strip.
 */
const PAGE_VISUALS: Record<string, { bg?: string; color: string }> = {
  "/": { bg: "/images/gallery/main/desktop/1.webp", color: "#0d1117" },
  "/nature": { bg: "/images/misc/bg_nature.webp", color: "#151616" },
  "/city": { bg: "/images/misc/bg_city.webp", color: "#3a3a3a" },
  "/walls": { color: "#0a0a0c" },
  "/blog": { color: "#0a0a0c" },
};

const BASE_DURATION = 800;
const PER_EXTRA_STEP = 320;
const FADE_OUT_MS = 320;

type ChainEvent = CustomEvent<{ from: string; to: string }>;

export default function ChainBridge() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [fading, setFading] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(0);
  const [duration, setDuration] = useState(BASE_DURATION);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    };

    const handler = (raw: Event) => {
      const e = raw as ChainEvent;
      const fIdx = PAGE_ORDER.indexOf(e.detail.from);
      const tIdx = PAGE_ORDER.indexOf(e.detail.to);
      if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;

      const distance = Math.abs(tIdx - fIdx);
      const dur = BASE_DURATION + (distance - 1) * PER_EXTRA_STEP;

      clearTimers();
      setFromIdx(fIdx);
      setToIdx(tIdx);
      setDuration(dur);
      setAnimating(false);
      setFading(false);
      setActive(true);

      // Kick off the route change immediately — the destination page
      // mounts behind the bridge while the strip is scrolling, so by
      // the time the bridge fades out the page is already settled.
      // The destination AppShell flips data-theme a frame later;
      // the shell's own `transition: color 0.4s ease` (in
      // Logo/TopNav/Socials .module.css, driven by
      // --shell-color-transition with a 0.4s default) handles the
      // colour cross-fade smoothly.
      router.push(e.detail.to);

      // Two RAFs: one to commit the initial transform (from-position),
      // one to flip the animating class so the transition runs from
      // there. Single rAF can fire before the browser has painted the
      // initial state, leaving the transition to skip its starting
      // keyframe.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });

      // End of the strip animation: bridge starts fading out.
      timersRef.current.push(
        window.setTimeout(() => setFading(true), dur)
      );
      // End of the fade-out: bridge unmounts.
      timersRef.current.push(
        window.setTimeout(() => {
          setActive(false);
          setAnimating(false);
          setFading(false);
        }, dur + FADE_OUT_MS)
      );
    };

    window.addEventListener("chainNavigate", handler);
    return () => {
      window.removeEventListener("chainNavigate", handler);
      clearTimers();
    };
  }, [router]);

  if (!active) return null;

  const style: CSSProperties = {
    "--bridge-from": `${-fromIdx * 100}vh`,
    "--bridge-to": `${-toIdx * 100}vh`,
    "--bridge-duration": `${duration}ms`,
    "--bridge-fade": `${FADE_OUT_MS}ms`,
  } as CSSProperties;

  return (
    <div
      className={`${styles.bridge} ${fading ? styles.fading : ""}`}
      style={style}
      aria-hidden="true"
    >
      <div className={`${styles.strip} ${animating ? styles.animating : ""}`}>
        {PAGE_ORDER.map((href) => {
          const v = PAGE_VISUALS[href] || { color: "#0a0a0c" };
          return (
            <div
              key={href}
              className={styles.slide}
              style={{
                backgroundColor: v.color,
                backgroundImage: v.bg ? `url(${v.bg})` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
