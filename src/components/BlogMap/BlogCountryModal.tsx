"use client";

import { useEffect } from "react";
import type { Visit } from "./visits";
import styles from "./BlogCountryModal.module.css";

type Props = {
  visit: Visit | null;
  onClose: () => void;
};

/**
 * Country detail panel. Slides in from the right of the viewport
 * when the user clicks one of the visited countries on /blog —
 * BlogMap enters "focus mode" at the same time, exploding the rest
 * of the world outward and gliding the selected country to the
 * left third. The panel is intentionally NOT a fullscreen modal:
 * the map stays visible (and interactive on the empty cream paper)
 * while the panel covers ~60 % of the viewport width on the right.
 *
 * Close hooks: the X button and Escape key. We deliberately don't
 * close on outside clicks because the map underneath is part of
 * the same scene the user is reading — accidental dismissal would
 * be jarring after the slow build-up animation.
 */
export default function BlogCountryModal({ visit, onClose }: Props) {
  useEffect(() => {
    if (!visit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [visit, onClose]);

  if (!visit) return null;

  return (
    <aside
      className={styles.backdrop}
      role="dialog"
      aria-modal="false"
      aria-label={`${visit.name} story`}
      data-blog-country-panel
    >
      <div className={styles.box}>
        <button
          type="button"
          className={styles.close}
          onClick={(e) => {
            // Stop propagation so the document-level pointerdown
            // close handler in BlogMap doesn't fire alongside this
            // (it would no-op because the target IS inside the
            // panel, but belt-and-suspenders).
            e.stopPropagation();
            onClose();
          }}
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
    </aside>
  );
}
