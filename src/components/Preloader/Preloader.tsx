"use client";

import { useEffect, useState } from "react";
import Logo from "../Logo/Logo";
import styles from "./Preloader.module.css";

const VISIBLE_MS = 2400;
const FADE_MS = 400;
// Same key is read+set by HomeSlider so the develop reveal also only
// plays once per session.
export const HOME_INTRO_KEY = "stukhin.home.intro";

export default function Preloader() {
  const [phase, setPhase] = useState<"visible" | "hiding" | "gone">("visible");

  useEffect(() => {
    // Already shown once in this browser session — skip entirely.
    // Hero photos are typically cached after the first load, so this
    // doubles as "if the photos are already there, don't make the user
    // wait through the loader again."
    if (
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(HOME_INTRO_KEY) === "1"
    ) {
      setPhase("gone");
      return;
    }

    const hide = window.setTimeout(() => setPhase("hiding"), VISIBLE_MS);
    const remove = window.setTimeout(
      () => setPhase("gone"),
      VISIBLE_MS + FADE_MS
    );
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(remove);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`${styles.preloader} ${
        phase === "hiding" ? styles.hiding : ""
      }`}
      aria-hidden={phase === "hiding"}
    >
      <Logo color="#000" noClick className={styles.logo} />
      <div className={styles.loader} aria-label="Loading">
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
        <span className={styles.bar} />
      </div>
    </div>
  );
}
