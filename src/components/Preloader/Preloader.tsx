"use client";

import { useEffect, useRef, useState } from "react";
import Logo from "../Logo/Logo";
import wallsData from "@/data/walls.json";
import styles from "./Preloader.module.css";

const FADE_MS = 400;
/** How long to hold the "100%" frame before fading the loader out. */
const HOLD_AT_FULL_MS = 250;
/**
 * Hard cap on the loader. Errors already count as "loaded", but a
 * request that simply stalls (flaky mobile network) would otherwise
 * hold the whole site behind the loader indefinitely.
 */
const MAX_WAIT_MS = 6000;

// sessionStorage gate so the loader only shows on the very first
// page hit per tab. The done-event that used to fire when the
// loader started its hide-fade is gone too — HomeSlider's TV-reveal
// listener got removed when the reveal animation was dropped, and
// nothing else subscribed.
const HOME_INTRO_KEY = "stukhin.home.intro";

// sessionStorage throws when site data is blocked (Safari "Block All
// Cookies", some in-app webviews). Unguarded, that throw kills
// hydration and the loader never lifts — treat it as "not seen yet".
function introSeen(): boolean {
  try {
    return window.sessionStorage.getItem(HOME_INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(HOME_INTRO_KEY, "1");
  } catch {
    // Storage unavailable — the loader just shows again next load.
  }
}

/**
 * Critical preload: things the very first painted screen needs (the
 * home hero photos) plus the visual surfaces every other in-strip
 * page leans on (page bgs, walls thumbs). Keep this list short and
 * the bytes light — it gates how long the loader is on screen.
 */
function buildCriticalUrls(): string[] {
  const list: string[] = [];

  // Home slider hero photos.
  for (let i = 1; i <= 4; i++) {
    list.push(`/images/gallery/main/desktop/${i}.webp`);
  }

  // Page backgrounds + frame chrome shared between /nature and /city.
  list.push("/images/misc/bg_nature.webp");
  list.push("/images/misc/bg_city.webp");
  list.push("/images/misc/picture_bg.webp");
  list.push("/images/misc/picture_bg_w.webp");
  list.push("/images/misc/picture_frame.webp");
  list.push("/images/misc/picture_frame_w.webp");
  list.push("/images/misc/tile.webp");

  // All walls thumbnails (small webps, ~10-25KB each). Lets the walls
  // grid render instantly the moment the user navigates in.
  (wallsData as { id: string }[]).forEach((w) => {
    list.push(`/images/walls/${w.id}_thumb.webp`);
  });

  return list;
}

/**
 * Background preload: things we want in the cache so /nature and
 * /city open instantly, but not worth blocking the loader on. Fired
 * once the loader finishes (so they don't compete with the critical
 * set for bandwidth) and skipped entirely under Data Saver.
 */
function buildBackgroundUrls(): string[] {
  const list: string[] = [];
  // Nature has 21 vertical photos in the gallery; city has 5.
  for (let i = 1; i <= 21; i++) {
    const num = String(i).padStart(2, "0");
    list.push(`/images/gallery/nature/vertical/${num}.jpg`);
  }
  for (let i = 1; i <= 5; i++) {
    const num = String(i).padStart(2, "0");
    list.push(`/images/gallery/city/vertical/${num}.jpg`);
  }
  return list;
}

export default function Preloader() {
  const [phase, setPhase] = useState<"loading" | "hiding" | "gone">("loading");
  const [progress, setProgress] = useState(0);
  // Guards against React StrictMode double-invocation in dev — without
  // it the effect would create two sets of <Image> instances and the
  // progress counter would race past 100%.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (typeof window === "undefined") return;

    // Already shown once in this browser session — skip entirely.
    // Photos cached after the first load, so this doubles as
    // "if the bytes are already there, don't make the user wait
    // through the loader again."
    if (introSeen()) {
      setPhase("gone");
      return;
    }

    const critical = buildCriticalUrls();
    const total = critical.length;
    if (total === 0) {
      setPhase("gone");
      markIntroSeen();
      return;
    }

    // While the loader covers the screen, page-strip gestures must
    // not navigate underneath it (see pageNavBlocked).
    const html = document.documentElement;
    html.classList.add("preloading");

    let loaded = 0;
    let finished = false;
    const timers: number[] = [];

    const preloadBackground = () => {
      const connection = (
        navigator as Navigator & { connection?: { saveData?: boolean } }
      ).connection;
      if (connection?.saveData) return;
      // Straight into the HTTP cache so /nature and /city feel
      // instant when the user gets there.
      buildBackgroundUrls().forEach((url) => {
        const img = new window.Image();
        img.src = url;
      });
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      setProgress(1);
      timers.push(
        window.setTimeout(() => {
          setPhase("hiding");
          html.classList.remove("preloading");
          markIntroSeen();
          preloadBackground();
          timers.push(
            window.setTimeout(() => {
              setPhase("gone");
            }, FADE_MS)
          );
        }, HOLD_AT_FULL_MS)
      );
    };

    const onOne = () => {
      loaded++;
      setProgress(loaded / total);
      if (loaded >= total) finish();
    };

    critical.forEach((url) => {
      const img = new window.Image();
      img.onload = onOne;
      img.onerror = onOne; // count errors as "loaded" so we never hang
      img.src = url;
    });

    timers.push(window.setTimeout(finish, MAX_WAIT_MS));

    return () => {
      timers.forEach(window.clearTimeout);
      html.classList.remove("preloading");
    };
  }, []);

  if (phase === "gone") return null;

  const pct = Math.round(progress * 100);

  return (
    <div
      className={`${styles.preloader} ${
        phase === "hiding" ? styles.hiding : ""
      }`}
      aria-hidden={phase === "hiding"}
    >
      <Logo noClick className={styles.logo} />
      {/* Bar + percentage are wrapped together so the percentage can
          sit directly above the bar's right edge regardless of where
          the bar lands on screen. */}
      <div className={styles.barWrap}>
        <div className={styles.percent} aria-live="polite">
          {pct}%
        </div>
        <div className={styles.bar} aria-label={`Loading ${pct}%`}>
          <span className={styles.fill} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
