"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./ScrollProgress.module.css";

/**
 * Hairline progress bar fixed to the bottom of the viewport. Fills
 * left-to-right as the user scrolls down the page, so on long-strip
 * pages (the wallpaper grid) it's obvious how much of the gallery is
 * left without scrolling all the way down to find the floor.
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const compute = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
    };
    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", compute);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      className={styles.track}
      style={{ "--progress": progress } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.fill} />
    </div>
  );
}
