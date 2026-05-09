"use client";

import { useEffect, useState } from "react";
import GridDistortion from "../GridDistortion/GridDistortion";
import { useVerticalPageSwipe } from "@/lib/useVerticalPageSwipe";
import { PAGE_VISUALS } from "@/lib/pageVisuals";
import styles from "./HomeSlider.module.css";

const slides = [
  "/images/gallery/main/desktop/1.webp",
  "/images/gallery/main/desktop/2.webp",
  "/images/gallery/main/desktop/3.webp",
  "/images/gallery/main/desktop/4.webp",
];

const AUTOPLAY_MS = 7000;
// sessionStorage key for the active slide so navigating away from /
// and back doesn't reset the photo to slide 1. Tab-scoped so a fresh
// tab still starts at slide 0.
const HOME_SLIDE_KEY = "stukhin.home.activeSlide";

export default function HomeSlider() {
  // Initial state always 0 to match SSR; the saved slide is read in
  // a useEffect after mount to avoid hydration mismatch warnings.
  const [active, setActive] = useState(0);
  // "forward" (autoplay / next) sweeps the photo crossfade right-
  // to-left; "backward" (prev arrow / left swipe) reverses to L-to-R
  // so the visual matches the navigation direction.
  const [direction, setDirection] = useState<"forward" | "backward">(
    "forward"
  );

  // First-load entrance is now just the Preloader's opacity fade-out
  // sitting over the slider. The earlier clip-path "TV reveal"
  // animation introduced visible jumps + flicker as the WebGL
  // canvas warmed up under it; with the reveal removed the photo
  // simply emerges as the white preloader fades. Cleaner.

  // Restore last-visited slide from this tab's sessionStorage. Lives
  // in a separate effect from the autoplay so the autoplay doesn't
  // race the restore (its setActive call would push us off the
  // restored index immediately).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(HOME_SLIDE_KEY);
      if (saved === null) return;
      const idx = parseInt(saved, 10);
      if (Number.isFinite(idx) && idx >= 0 && idx < slides.length) {
        setActive(idx);
      }
    } catch {
      // sessionStorage disabled — first-time-load behaviour is fine.
    }
  }, []);

  // Persist active slide AND sync the chain-bridge's "/" bg to the
  // currently-displayed photo. Without the second update, navigating
  // away from / always plays the bridge from slide 1 even if the
  // user was on slide 3 — produced a visible jump back to slide 1
  // right before the chain animation started.
  useEffect(() => {
    try {
      sessionStorage.setItem(HOME_SLIDE_KEY, String(active));
    } catch {}
    PAGE_VISUALS["/"].bg = slides[active];
  }, [active]);

  const next = () => {
    setDirection("forward");
    setActive((i) => (i + 1) % slides.length);
  };
  const prev = () => {
    setDirection("backward");
    setActive((i) => (i - 1 + slides.length) % slides.length);
  };

  // Autoplay timer. Restarted on every `active` change so a manual
  // prev/next/dot click doesn't leave the previous interval still
  // counting from the LAST autoplay tick — that was producing the
  // "I just clicked but the photo flipped half a second later" glitch.
  // setTimeout (single shot, scheduled fresh each render) cleanly
  // reflects "7 s after THIS slide became active".
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDirection("forward");
      setActive((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [active]);

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

  // Force the dark theme for the whole / route, regardless of the
  // active slide's luminance. Even on bright photos, we want the
  // shell glyphs (logo, top-nav, socials) and the dot indicators
  // to stay white so the home page reads as a single visual
  // identity instead of flipping between light and dark per slide.
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

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
    <div className={styles.wrap}>
      <div className={styles.slider}>
        <div className={styles.canvas}>
          {isDesktop ? (
            <GridDistortion
              imageSrc={slides[active]}
              direction={direction}
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
            onClick={() => {
              setDirection(i >= active ? "forward" : "backward");
              setActive(i);
            }}
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
