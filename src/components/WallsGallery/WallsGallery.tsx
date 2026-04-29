"use client";

import { useEffect, useState } from "react";
import styles from "./WallsGallery.module.css";

export type Wallpaper = {
  id: string;
  title: string;
  location: string;
  year: number;
  story: string;
  downloads: number;
};

type Props = {
  items: Wallpaper[];
};

type DownloadState = "idle" | "loading" | "done";

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);

  // Persist download counts in localStorage so it grows over visits.
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
      <div className={styles.intro}>
        <h1 className={styles.title}>walls</h1>
        <p className={styles.subtitle}>
          A small set of phone wallpapers, free to download.
        </p>
      </div>

      <ul className={styles.grid}>
        {items.map((w) => {
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
