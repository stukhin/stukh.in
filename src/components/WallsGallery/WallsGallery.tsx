"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./WallsGallery.module.css";

export type Wallpaper = {
  id: string;
  title: string;
  location: string;
  year: number;
  story: string;
  downloads: number;
  category: string;
};

type Props = {
  items: Wallpaper[];
};

type DownloadState = "idle" | "loading" | "done";

const ALL = "All";
const GHOST_COUNT = 4;

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  /** Refs to each card's <img>, keyed by wallpaper id, so we can flag
   * the clicked one with view-transition-name and let the browser
   * animate it growing into the zoom modal. */
  const cardImgRefs = useRef<Record<string, HTMLImageElement | null>>({});

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((w) => set.add(w.category));
    return [ALL, ...Array.from(set).sort()];
  }, [items]);

  const visibleItems = useMemo(
    () =>
      activeCategory === ALL
        ? items
        : items.filter((w) => w.category === activeCategory),
    [items, activeCategory]
  );

  // Persist download counts in localStorage so they grow over visits.
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("walls.downloads") || "{}");
    const initial: Record<string, number> = {};
    for (const w of items) {
      initial[w.id] = saved[w.id] ?? w.downloads;
    }
    setCounts(initial);
  }, [items]);

  const persist = (next: Record<string, number>) => {
    localStorage.setItem("walls.downloads", JSON.stringify(next));
  };

  const download = async (w: Wallpaper) => {
    if (downloads[w.id] === "loading") return;
    setDownloads((s) => ({ ...s, [w.id]: "loading" }));
    try {
      const res = await fetch(`/images/walls/${w.id}.webp`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stukhin-${w.id}.webp`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setCounts((c) => {
        const next = { ...c, [w.id]: (c[w.id] || w.downloads) + 1 };
        persist(next);
        return next;
      });
      setDownloads((s) => ({ ...s, [w.id]: "done" }));
      window.setTimeout(
        () => setDownloads((s) => ({ ...s, [w.id]: "idle" })),
        1600
      );
    } catch {
      setDownloads((s) => ({ ...s, [w.id]: "idle" }));
    }
  };

  const supportsVT = () =>
    typeof document !== "undefined" && "startViewTransition" in document;

  const openZoom = (w: Wallpaper) => {
    const imgEl = cardImgRefs.current[w.id];
    if (imgEl && supportsVT()) {
      imgEl.style.viewTransitionName = "wall-zoom";
      const t = document.startViewTransition(() => setZoomed(w));
      t.finished.finally(() => {
        imgEl.style.viewTransitionName = "";
      });
    } else {
      setZoomed(w);
    }
  };

  const closeZoom = () => {
    const w = zoomed;
    if (!w) return;
    const imgEl = cardImgRefs.current[w.id];
    if (imgEl && supportsVT()) {
      imgEl.style.viewTransitionName = "wall-zoom";
      const t = document.startViewTransition(() => setZoomed(null));
      t.finished.finally(() => {
        imgEl.style.viewTransitionName = "";
      });
    } else {
      setZoomed(null);
    }
  };

  // ESC closes the zoom view
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed]);

  return (
    <>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <ul className={styles.catList}>
            {categories.map((cat) => {
              const isActive = cat === activeCategory;
              return (
                <li key={cat}>
                  <button
                    type="button"
                    className={`${styles.catBtn} ${
                      isActive ? styles.catActive : ""
                    }`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat.toLowerCase()}
                    <span className={styles.catUnderline} />
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <ul className={styles.grid}>
          {visibleItems.map((w) => {
            const state = downloads[w.id] || "idle";
            const count = counts[w.id] ?? w.downloads;
            return (
              <li key={w.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.frame}
                  onClick={() => openZoom(w)}
                  aria-label={`Open ${w.title}`}
                >
                  <img
                    ref={(el) => {
                      cardImgRefs.current[w.id] = el;
                    }}
                    src={`/images/walls/${w.id}_thumb.webp`}
                    alt={w.title}
                    className={styles.thumb}
                    draggable={false}
                  />

                  {/* Six frosted-glass chunks of different shapes; CSS
                      animates them in one after another on hover. */}
                  <span className={`${styles.chunk} ${styles.chunk1}`} />
                  <span className={`${styles.chunk} ${styles.chunk2}`} />
                  <span className={`${styles.chunk} ${styles.chunk3}`} />
                  <span className={`${styles.chunk} ${styles.chunk4}`} />
                  <span className={`${styles.chunk} ${styles.chunk5}`} />
                  <span className={`${styles.chunk} ${styles.chunk6}`} />

                  {state === "loading" && (
                    <span className={styles.loader} aria-hidden="true">
                      <span className={styles.bar} />
                    </span>
                  )}
                  {state === "done" && (
                    <span className={styles.toast} aria-hidden="true">
                      Saved
                    </span>
                  )}

                  <span className={styles.overlay}>
                    <span className={styles.info}>
                      <span className={styles.cardTitle}>{w.title}</span>
                      <span className={styles.meta}>
                        {w.location} · {w.year}
                      </span>
                      <span className={styles.story}>{w.story}</span>
                    </span>

                    <span className={styles.magnifier} aria-hidden="true">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                      </svg>
                    </span>

                    <span className={styles.counter}>
                      {count.toLocaleString()} downloads
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

          {/* Soft empty placeholders hinting more wallpapers will land
              here. They keep the grid feeling populated even when the
              last row is half-empty. */}
          {Array.from({ length: GHOST_COUNT }).map((_, i) => (
            <li
              key={`ghost-${i}`}
              className={styles.ghost}
              aria-hidden="true"
            >
              <span className={styles.ghostHint}>soon</span>
            </li>
          ))}
        </ul>
      </div>

      {zoomed && (
        <div
          className={styles.zoom}
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.title} preview`}
          onClick={closeZoom}
        >
          <img
            src={`/images/walls/${zoomed.id}.webp`}
            alt={zoomed.title}
            className={styles.zoomImage}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            style={{ viewTransitionName: "wall-zoom" }}
          />
          <button
            type="button"
            className={styles.zoomClose}
            onClick={closeZoom}
            aria-label="Close preview"
          >
            <span />
            <span />
          </button>
          <button
            type="button"
            className={styles.zoomDownload}
            onClick={(e) => {
              e.stopPropagation();
              download(zoomed);
            }}
            disabled={(downloads[zoomed.id] || "idle") === "loading"}
          >
            Download
          </button>
        </div>
      )}
    </>
  );
}
