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
const GHOST_COUNT = 4;
const ZOOM_OUT_MS = 360;

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
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

  const openZoom = (w: Wallpaper) => {
    setZoomClosing(false);
    setZoomed(w);
  };

  const closeZoom = () => {
    if (!zoomed || zoomClosing) return;
    setZoomClosing(true);
    window.setTimeout(() => {
      setZoomed(null);
      setZoomClosing(false);
    }, ZOOM_OUT_MS);
  };

  // Lock the underlying scroll while the zoom view is open, hide the
  // burger so it doesn't bleed through the dim layer, and let ESC
  // close it.
  useEffect(() => {
    if (!zoomed) return;
    document.body.classList.add("hidden");
    document.documentElement.classList.add("zoom-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("hidden");
      document.documentElement.classList.remove("zoom-open");
      window.removeEventListener("keydown", onKey);
    };
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
                  data-cursor="magnifier"
                >
                  <img
                    src={`/images/walls/${w.id}_thumb.webp`}
                    alt={w.title}
                    className={styles.thumb}
                    draggable={false}
                  />
                  {/* Six frosted-glass chunks of different shapes;
                      animate in on hover one after another. */}
                  <span className={`${styles.chunk} ${styles.chunk1}`} />
                  <span className={`${styles.chunk} ${styles.chunk2}`} />
                  <span className={`${styles.chunk} ${styles.chunk3}`} />
                  <span className={`${styles.chunk} ${styles.chunk4}`} />
                  <span className={`${styles.chunk} ${styles.chunk5}`} />
                  <span className={`${styles.chunk} ${styles.chunk6}`} />

                  {/* Description in the top-left, fades in after the
                      glass settles. */}
                  <span className={styles.info}>
                    <span className={styles.cardTitle}>{w.title}</span>
                    <span className={styles.meta}>
                      {w.location} · {w.year}
                    </span>
                    <span className={styles.story}>{w.story}</span>
                  </span>

                  <span className={styles.counter}>
                    {count.toLocaleString()} downloads
                  </span>

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
                </button>

                {/* Download lives outside the frame button so its hover
                    is the regular dot cursor (not the magnifier) and
                    its click doesn't open the zoom view. */}
                <button
                  type="button"
                  className={styles.downloadBtn}
                  onClick={() => download(w)}
                  disabled={state === "loading"}
                  aria-label={`Download ${w.title}`}
                  data-cursor="hover"
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
          className={`${styles.zoom} ${zoomClosing ? styles.zoomClosing : ""}`}
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
          />
          <button
            type="button"
            className={styles.zoomDownload}
            onClick={(e) => {
              e.stopPropagation();
              download(zoomed);
            }}
            disabled={(downloads[zoomed.id] || "idle") === "loading"}
            data-cursor="hover"
          >
            Download
          </button>
        </div>
      )}
    </>
  );
}
