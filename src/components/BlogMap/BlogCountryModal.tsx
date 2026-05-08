"use client";

import { useEffect } from "react";
import type { Visit } from "./visits";
import styles from "./BlogCountryModal.module.css";

type Props = {
  visit: Visit | null;
  onClose: () => void;
};

/**
 * Country detail popup. Opens when the user clicks one of the visited
 * countries on the map. Rectangular box (no rounded corners) on a
 * frosted-glass backdrop — same right-angle aesthetic as the rest of
 * the site. Holds dates, cities, a description, and a list of
 * recommendations; eventually photos will live here too.
 *
 * Closes on backdrop click, the X button, or Escape. Locks body
 * scroll while open via the existing global "hidden" + "zoom-open"
 * classes (the same hooks the gallery / walls modals use, so the
 * shell elements like the burger and logo dim out cleanly).
 */
export default function BlogCountryModal({ visit, onClose }: Props) {
  useEffect(() => {
    if (!visit) return;
    document.body.classList.add("hidden");
    document.documentElement.classList.add("zoom-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("hidden");
      document.documentElement.classList.remove("zoom-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [visit, onClose]);

  if (!visit) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${visit.name} story`}
    >
      <div className={styles.box} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close"
          data-cursor="hover"
        >
          ×
        </button>

        <header className={styles.head}>
          <h2 className={styles.name}>{visit.name}</h2>
          <p className={styles.dates}>{visit.dates}</p>
        </header>

        <div className={styles.body}>
          {visit.description && (
            <p className={styles.description}>{visit.description}</p>
          )}

          {visit.cities.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>cities</h3>
              <p className={styles.sectionBody}>
                {visit.cities.join(" · ")}
              </p>
            </section>
          )}

          {visit.recommendations && visit.recommendations.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>worth your time</h3>
              <ul className={styles.list}>
                {visit.recommendations.map((r, i) => (
                  <li key={i} className={styles.listItem}>
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className={styles.placeholder}>
            full story + photos coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
