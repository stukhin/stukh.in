"use client";

import { useEffect, useRef, useState } from "react";
import Menu from "../Menu/Menu";
import Socials from "../Socials/Socials";
import styles from "./MenuPopup.module.css";

type Props = {
  open: boolean;
  onClose?: () => void;
  className?: string;
};

export default function MenuPopup({ open, onClose, className = "" }: Props) {
  const [animating, setAnimating] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Initialise hidden state on mount
  useEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.visibility = "hidden";
    el.style.pointerEvents = "none";
    el.style.transition = "opacity 0.5s ease";
  }, []);

  // ESC closes the popup
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const el = popupRef.current;
    if (!el) return;

    if (open) {
      document.body.classList.add("hidden");
      el.style.visibility = "visible";
      el.style.pointerEvents = "auto";
      // Give the browser a frame to apply visibility before changing opacity so the transition runs
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.opacity = "1";
        });
      });
      const t = setTimeout(() => setAnimating(true), 100);
      return () => clearTimeout(t);
    } else {
      setAnimating(false);
      document.body.classList.remove("hidden");
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      const t = setTimeout(() => {
        if (popupRef.current) popupRef.current.style.visibility = "hidden";
      }, 500);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div
      ref={popupRef}
      className={[styles.popup, className].filter(Boolean).join(" ")}
      aria-hidden={!open}
    >
      <div className={styles.content}>
        <Menu
          column
          className={`${styles.menu} ${animating ? styles.menuAnimating : ""}`}
          onNavigate={onClose}
          navigateDelayMs={500}
        />
        <div className={`${styles.wrapper} ${animating ? styles.wrapperVisible : ""}`}>
          <Socials className={styles.social} />
          <div className={styles.text}>Sasha Stukhin</div>
          <div className={styles.text}>
            All rights reserved © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
}
