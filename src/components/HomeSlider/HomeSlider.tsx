"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import GridDistortion from "../GridDistortion/GridDistortion";
import {
  HOME_INTRO_KEY,
  PRELOADER_DONE_EVENT,
} from "../Preloader/Preloader";
import { useVerticalPageSwipe } from "@/lib/useVerticalPageSwipe";
import styles from "./HomeSlider.module.css";

const slides = [
  "/images/gallery/main/desktop/1.webp",
  "/images/gallery/main/desktop/2.webp",
  "/images/gallery/main/desktop/3.webp",
  "/images/gallery/main/desktop/4.webp",
];

const AUTOPLAY_MS = 7000;
/** Duration of the TV-style reveal — the photo grows vertically out
 *  of a thin horizontal line into the full slider. */
const REVEAL_MS = 1500;

// Mid-grey threshold (0–1) for picking light vs dark theme. Anything
// above is "light enough that black glyphs read better"; anything
// below gets the default dark theme (white glyphs).
const LUMINANCE_THRESHOLD = 0.55;

/** Compute the average perceived luminance (0–1) of an image, sampled
 *  via a 16×16 canvas. Uses Rec. 601 weights. */
async function sampleLuminance(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext("2d");
      if (!ctx) {
        resolve(0);
        return;
      }
      try {
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        resolve(sum / (data.length / 4) / 255);
      } catch {
        resolve(0);
      }
    };
    img.onerror = () => resolve(0);
    img.src = src;
  });
}

export default function HomeSlider() {
  const [active, setActive] = useState(0);

  /**
   * "TV-on" reveal: starts the photo as a thin horizontal line and
   * grows it vertically into a full slide over ~1.5s, then settles.
   * The phase drives a CSS class on the slider.
   *
   *  - "done"    : final state (no animation). Used both by users
   *                returning later in the session (we skip the
   *                entrance) and by the slider after the reveal
   *                completes.
   *  - "pending" : pre-roll state — the slide is collapsed to a
   *                line waiting for the preloader to fade out.
   *  - "playing" : 1.5s opening animation in progress.
   *
   * Default state is "done" so SSR and the very first client render
   * agree on the markup (no hydration mismatch). A useLayoutEffect
   * post-mount inspects sessionStorage and either skips the entrance
   * or schedules it via the preloader-done event.
   */
  const [reveal, setReveal] = useState<"done" | "pending" | "playing">(
    "done"
  );
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // Already shown in this tab — no entrance, just static slider.
    if (window.sessionStorage.getItem(HOME_INTRO_KEY) === "1") return;

    setReveal("pending");
    let endTimer: number | null = null;
    const onPreloaderDone = () => {
      setReveal("playing");
      endTimer = window.setTimeout(() => setReveal("done"), REVEAL_MS);
    };
    window.addEventListener(PRELOADER_DONE_EVENT, onPreloaderDone);
    return () => {
      window.removeEventListener(PRELOADER_DONE_EVENT, onPreloaderDone);
      if (endTimer !== null) window.clearTimeout(endTimer);
    };
  }, []);

  const next = () => setActive((i) => (i + 1) % slides.length);
  const prev = () =>
    setActive((i) => (i - 1 + slides.length) % slides.length);

  // Autoplay starts right away — the preloader gates first-visit
  // display, so by the time HomeSlider is visible the photos are
  // already cached and ready to cycle.
  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, []);

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Touch (mobile only): swipe up/down navigates between PAGE_ORDER
  // blocks; swipe left/right cycles between hero photos. Vertical
  // sits in a shared hook (also used by GallerySlider on /nature
  // and /city); horizontal is local because it talks to this
  // component's prev/next.
  useVerticalPageSwipe();
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: none)").matches) return;

    let start: { x: number; y: number; t: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        start = null;
        return;
      }
      start = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: performance.now(),
      };
    };

    const onTouchEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - s.x;
      const dy = touch.clientY - s.y;
      const dt = performance.now() - s.t;

      // Horizontal-dominant swipe with sensible distance / duration.
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (Math.abs(dx) < 50) return;
      if (dt > 800) return;

      if (dx < 0) next();
      else prev();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Pre-sample the luminance of every slide once on mount, then flip
  // <html data-theme="..."> as the active slide changes. Glyphs in
  // the shell (logo, top-nav, socials) are pure black or pure white
  // — the threshold here is what decides which.
  const [luminance, setLuminance] = useState<number[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(slides.map(sampleLuminance)).then((values) => {
      if (!cancelled) setLuminance(values);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const v = luminance[active];
    if (v === undefined) return;
    document.documentElement.dataset.theme =
      v > LUMINANCE_THRESHOLD ? "light" : "dark";
  }, [active, luminance]);

  // GridDistortion is desktop-only: it's a heavy WebGL effect and the
  // mouse-warp idea doesn't translate to touch input anyway. Below the
  // desktop breakpoint we fall back to a plain background-image div so
  // the photo still shows correctly.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const revealClass =
    reveal === "pending"
      ? styles.revealPending
      : reveal === "playing"
      ? styles.revealPlaying
      : "";

  return (
    <div className={`${styles.wrap} ${revealClass}`}>
      <div className={styles.slider}>
        <div className={styles.canvas}>
          {isDesktop ? (
            <GridDistortion
              imageSrc={slides[active]}
              grid={18}
              mouse={0.10}
              strength={0.02}
              relaxation={0.92}
            />
          ) : (
            <div
              className={styles.fallback}
              style={{ backgroundImage: `url(${slides[active]})` }}
            />
          )}
        </div>
      </div>

      {/* Edge click zones with custom arrow cursor */}
      <button
        type="button"
        className={`${styles.navZone} ${styles.navPrev}`}
        onClick={prev}
        aria-label="Previous slide"
        data-cursor="arrow-left"
      />
      <button
        type="button"
        className={`${styles.navZone} ${styles.navNext}`}
        onClick={next}
        aria-label="Next slide"
        data-cursor="arrow-right"
      />

      <div className={styles.dots}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
          >
            <span className={styles.bar}>
              <span key={`v-${i}-${active}`} className={styles.value} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
