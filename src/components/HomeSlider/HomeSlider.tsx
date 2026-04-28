"use client";

import { useEffect, useState } from "react";
import styles from "./HomeSlider.module.css";

const slides = [
  "/images/gallery/main/desktop/1.jpg",
  "/images/gallery/main/desktop/2.jpg",
  "/images/gallery/main/desktop/3.jpg",
  "/images/gallery/main/desktop/4.jpg",
];

const AUTOPLAY_MS = 7000;

export default function HomeSlider() {
  const [active, setActive] = useState(0);

  const next = () => setActive((i) => (i + 1) % slides.length);
  const prev = () =>
    setActive((i) => (i - 1 + slides.length) % slides.length);

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

  return (
    <div className={styles.wrap}>
      <div className={styles.slider}>
        {slides.map((src, i) => (
          <div
            key={src}
            className={`${styles.slide} ${i === active ? styles.active : ""}`}
          >
            <div
              className={styles.slide_image}
              style={{ backgroundImage: `url(${src})` }}
            />
          </div>
        ))}
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
