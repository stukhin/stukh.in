"use client";

import { useState } from "react";
import styles from "./HomeToggle.module.css";

type Props = {
  /**
   * Text/track/thumb colour. Inherits from page (light bg → dark
   * colour, dark bg → light colour). Defaults to white.
   */
  color?: string;
  className?: string;
};

type Mode = "hobby" | "work";

/**
 * Hobby / work mode toggle. Lives only on the homepage, top-right
 * area. For now it's a visual stub — flipping the switch updates
 * local state and that's it. Once a separate work portfolio exists
 * the "work" position will navigate there.
 */
export default function HomeToggle({ color = "#fff", className = "" }: Props) {
  const [mode, setMode] = useState<Mode>("hobby");

  return (
    <div
      className={`${styles.toggle} ${className}`}
      style={{ color }}
      role="group"
      aria-label="Hobby or work mode"
    >
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
        className={`${styles.track} ${mode === "work" ? styles.right : ""}`}
        onClick={() => setMode((m) => (m === "hobby" ? "work" : "hobby"))}
        aria-label={`Switch to ${mode === "hobby" ? "work" : "hobby"}`}
        data-cursor="hover"
      >
        <span className={styles.thumb} aria-hidden="true" />
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
