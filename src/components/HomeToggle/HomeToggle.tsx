"use client";

import { useState } from "react";
import styles from "./HomeToggle.module.css";

type Mode = "hobby" | "work";

/**
 * Hobby / work mode toggle. Lives only on the homepage, top-right.
 * The labels themselves are the slider — clicking either one slides
 * a frosted-glass pill behind it. There's no separate thumb. For
 * now flipping the switch is a visual stub; the "work" position
 * will navigate to a separate work portfolio once that exists.
 */
export default function HomeToggle({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("hobby");

  return (
    <div
      className={`${styles.toggle} ${
        mode === "work" ? styles.modeWork : styles.modeHobby
      } ${className}`}
      role="group"
      aria-label="Hobby or work mode"
    >
      <span className={styles.indicator} aria-hidden="true" />
      <button
        type="button"
        className={`${styles.label} ${mode === "hobby" ? styles.active : ""}`}
        onClick={() => setMode("hobby")}
        aria-pressed={mode === "hobby"}
        data-cursor="hover"
      >
        hobby
      </button>
      <button
        type="button"
        className={`${styles.label} ${mode === "work" ? styles.active : ""}`}
        onClick={() => setMode("work")}
        aria-pressed={mode === "work"}
        data-cursor="hover"
      >
        work
      </button>
    </div>
  );
}
