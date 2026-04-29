"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

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

  // ESC closes the zoom view
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
                <div className={styles.frame}>
                  <img
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
                    <div className={styles.loader} aria-hidden="true">
                      <div className={styles.bar} />
                    </div>
                  )}
                  {state === "done" && (
                    <div className={styles.toast} aria-hidden="true">
                      Saved
                    </div>
                  )}

                  <div className={styles.overlay}>
                    <div className={styles.info}>
                      <h3 className={styles.cardTitle}>{w.title}</h3>
                      <p className={styles.meta}>
                        {w.location} · {w.year}
                      </p>
                      <p className={styles.story}>{w.story}</p>
                    </div>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.action}
                        aria-label={`Zoom ${w.title}`}
                        onClick={() => setZoomed(w)}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={styles.action}
                        aria-label={`Download ${w.title}`}
                        onClick={() => download(w)}
                        disabled={state === "loading"}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        >
                          <path d="M12 4v12" strokeLinecap="round" />
                          <path
                            d="m6 11 6 6 6-6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path d="M5 20h14" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.counter}>
                      {count.toLocaleString()} downloads
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {zoomed && (
        <div
          className={styles.zoom}
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.title} preview`}
          onClick={() => setZoomed(null)}
        >
          <img
            src={`/images/walls/${zoomed.id}.webp`}
            alt={zoomed.title}
            className={styles.zoomImage}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className={styles.zoomClose}
            onClick={() => setZoomed(null)}
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
