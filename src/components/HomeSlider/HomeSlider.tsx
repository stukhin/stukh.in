"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import GridDistortion from "../GridDistortion/GridDistortion";
import { HOME_INTRO_KEY } from "../Preloader/Preloader";
import styles from "./HomeSlider.module.css";

const slides = [
  "/images/gallery/main/desktop/1.webp",
  "/images/gallery/main/desktop/2.webp",
  "/images/gallery/main/desktop/3.webp",
  "/images/gallery/main/desktop/4.webp",
];

const AUTOPLAY_MS = 7000;
// Wait for the preloader (2400ms visible + 400ms fade) before kicking
// off the develop animation, so the user sees: loader → reveal → photo.
const PRELOADER_DURATION = 2800;
const REVEAL_DURATION = 2500;

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
  /** First-load reveal: photo "develops" through 4 stages — hidden,
   * high-contrast B&W sketch, softer B&W, full colour. Plays only on
   * the first visit per browser session; subsequent visits show the
   * photo directly. */
  const [revealing, setRevealing] = useState(true);

  // Sync flag check before paint — avoids a one-frame flash of the
  // hidden 0% keyframe state on subsequent visits.
  useLayoutEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(HOME_INTRO_KEY) === "1"
    ) {
      setRevealing(false);
    }
  }, []);

  useEffect(() => {
    if (!revealing) return;
    const t = window.setTimeout(() => {
      setRevealing(false);
      window.sessionStorage.setItem(HOME_INTRO_KEY, "1");
    }, PRELOADER_DURATION + REVEAL_DURATION);
    return () => window.clearTimeout(t);
  }, [revealing]);

  const next = () => setActive((i) => (i + 1) % slides.length);
  const prev = () =>
    setActive((i) => (i - 1 + slides.length) % slides.length);

  // Hold autoplay until the develop reveal finishes — otherwise the
  // active slide could swap mid-animation.
  useEffect(() => {
    if (revealing) return;
    const id = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [revealing]);

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  return (
    <div className={`${styles.wrap} ${revealing ? styles.revealing : ""}`}>
      <div className={styles.slider}>
        <div className={styles.canvas}>
          {isDesktop ? (
            <GridDistortion
              imageSrc={slides[active]}
              grid={18}
              mouse={0.12}
              strength={0.04}
              relaxation={0.93}
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
