"use client";

import { useEffect, useState } from "react";
import type { GalleryItem } from "../GallerySlider/GallerySlider";
import styles from "./GalleryModal.module.css";

type Props = {
  open: boolean;
  category: "nature" | "city";
  item?: GalleryItem;
  index: number;
  orientation: "vertical" | "horizontal";
  onClose: () => void;
  onOrientationChange: (o: "vertical" | "horizontal") => void;
};

export default function GalleryModal({
  open,
  category,
  item,
  index,
  orientation,
  onClose,
  onOrientationChange,
}: Props) {
  const [mounted, setMounted] = useState(false);

  // Control mounted state so we can animate in/out
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const t = setTimeout(() => setMounted(false), 260);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted || !item) return null;

  const pic = String(index + 1).padStart(2, "0");
  const src = `/images/gallery/${category}/${orientation}/${pic}.jpg`;

  return (
    <div
      className={`${styles.modal} ${open ? styles.open : ""}`}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.container}>
        <img
          alt={item.title}
          loading="lazy"
          decoding="async"
          className={styles.picture}
          src={src}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            if (orientation === "horizontal") {
              el.src = `/images/gallery/${category}/vertical/${pic}.jpg`;
            }
          }}
        />
      </div>
      <div className={styles.buttons}>
        <div className={styles.actionButtons}>
          <button
            className={`${styles.button} ${styles.close}`}
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <span className={styles.bar} />
            <span className={styles.bar} />
          </button>
        </div>
        <div className={styles.resizeButtons}>
          <button
            className={`${styles.button} ${
              orientation === "vertical" ? styles.active : ""
            }`}
            type="button"
            onClick={() => onOrientationChange("vertical")}
            aria-label="Vertical"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="none"
            >
              <path
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19.833 3.5H8.167a2.333 2.333 0 0 0-2.334 2.333v16.334A2.333 2.333 0 0 0 8.167 24.5h11.666a2.333 2.333 0 0 0 2.334-2.333V5.833A2.333 2.333 0 0 0 19.833 3.5Z"
              />
            </svg>
          </button>
          <button
            className={`${styles.button} ${
              orientation === "horizontal" ? styles.active : ""
            }`}
            type="button"
            onClick={() => onOrientationChange("horizontal")}
            aria-label="Horizontal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="none"
              style={{ transform: "rotate(90deg)" }}
            >
              <path
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19.833 3.5H8.167a2.333 2.333 0 0 0-2.334 2.333v16.334A2.333 2.333 0 0 0 8.167 24.5h11.666a2.333 2.333 0 0 0 2.334-2.333V5.833A2.333 2.333 0 0 0 19.833 3.5Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
