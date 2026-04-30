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

  return (
    <div className={`${styles.wrap} ${revealing ? styles.revealing : ""}`}>
      <div className={styles.slider}>
        <div className={styles.canvas}>
          <GridDistortion
            imageSrc={slides[active]}
            grid={18}
            mouse={0.18}
            strength={0.18}
            relaxation={0.92}
          />
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
