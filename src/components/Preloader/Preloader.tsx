"use client";

import { useEffect, useState } from "react";
import Logo from "../Logo/Logo";
import styles from "./Preloader.module.css";

const VISIBLE_MS = 2400;
const FADE_MS = 400;

export default function Preloader() {
  const [phase, setPhase] = useState<"visible" | "hiding" | "gone">("visible");

  useEffect(() => {
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
      <div className={styles.loader} aria-label="Loading" />
    </div>
  );
}
