"use client";

import {
  MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
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

type DownloadState = "idle" | "loading" | "done";

type Props = {
  items: Wallpaper[];
};

const ALL = "All";
const GHOST_COUNT = 4;
const ZOOM_IN_MS = 500;
const ZOOM_OUT_MS = 400;
const TILT_AMPLITUDE = 9;
const SPRING = { damping: 30, stiffness: 100, mass: 1.4 };

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  const cardImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const modalImgRef = useRef<HTMLImageElement>(null);
  const fromRectRef = useRef<DOMRect | null>(null);

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
    const cardImg = cardImgRefs.current[w.id];
    fromRectRef.current = cardImg ? cardImg.getBoundingClientRect() : null;
    setZoomClosing(false);
    setZoomed(w);
  };

  const closeZoom = () => {
    if (!zoomed || zoomClosing) return;
    // Re-capture the card's rect in case the scroll/tilt state shifted
    // since the click that opened the zoom.
    const cardImg = cardImgRefs.current[zoomed.id];
    if (cardImg) fromRectRef.current = cardImg.getBoundingClientRect();
    const modalImg = modalImgRef.current;
    const from = fromRectRef.current;
    if (modalImg && from) {
      const target = modalImg.getBoundingClientRect();
      const dx =
        from.left + from.width / 2 - (target.left + target.width / 2);
      const dy =
        from.top + from.height / 2 - (target.top + target.height / 2);
      const scale = from.width / target.width;
      modalImg.style.transition = `transform ${ZOOM_OUT_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      modalImg.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    }
    setZoomClosing(true);
    window.setTimeout(() => {
      setZoomed(null);
      setZoomClosing(false);
    }, ZOOM_OUT_MS);
  };

  // Run the FLIP morph as soon as the modal img mounts. Place it at
  // the card's exact rect with transform, force a reflow, then animate
  // to its natural position.
  useLayoutEffect(() => {
    if (!zoomed || zoomClosing) return;
    const modalImg = modalImgRef.current;
    const from = fromRectRef.current;
    if (!modalImg || !from) return;
    const target = modalImg.getBoundingClientRect();
    const dx =
      from.left + from.width / 2 - (target.left + target.width / 2);
    const dy =
      from.top + from.height / 2 - (target.top + target.height / 2);
    const scale = from.width / target.width;
    modalImg.style.transition = "none";
    modalImg.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    // Force layout so the next frame starts from the new transform.
    void modalImg.getBoundingClientRect();
    requestAnimationFrame(() => {
      if (!modalImgRef.current) return;
      modalImgRef.current.style.transition = `transform ${ZOOM_IN_MS}ms cubic-bezier(0.65, 0, 0.35, 1)`;
      modalImgRef.current.style.transform = "translate(0, 0) scale(1)";
    });
  }, [zoomed, zoomClosing]);

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
              <WallpaperCard
                key={w.id}
                wallpaper={w}
                count={count}
                state={state}
                onZoom={openZoom}
                onDownload={download}
                registerImg={(el) => {
                  cardImgRefs.current[w.id] = el;
                }}
              />
            );
          })}

          {/* Soft empty placeholders hinting more wallpapers will land
              here. */}
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
            ref={modalImgRef}
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

type CardProps = {
  wallpaper: Wallpaper;
  count: number;
  state: DownloadState;
  onZoom: (w: Wallpaper) => void;
  onDownload: (w: Wallpaper) => void;
  registerImg: (el: HTMLImageElement | null) => void;
};

function WallpaperCard({
  wallpaper,
  count,
  state,
  onZoom,
  onDownload,
  registerImg,
}: CardProps) {
  const ref = useRef<HTMLLIElement>(null);
  const rotateX = useSpring(useMotionValue(0), SPRING);
  const rotateY = useSpring(useMotionValue(0), SPRING);
  const scale = useSpring(1, SPRING);

  function handleMove(e: MouseEvent<HTMLLIElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -TILT_AMPLITUDE);
    rotateY.set((offsetX / (rect.width / 2)) * TILT_AMPLITUDE);
  }

  function handleEnter() {
    scale.set(1.04);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }

  return (
    <li
      ref={ref}
      className={styles.card}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <motion.div
        className={styles.tilt}
        style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d" }}
      >
        <button
          type="button"
          className={styles.frame}
          onClick={() => onZoom(wallpaper)}
          aria-label={`Open ${wallpaper.title}`}
          data-cursor="magnifier"
        >
          <img
            ref={registerImg}
            src={`/images/walls/${wallpaper.id}_thumb.webp`}
            alt={wallpaper.title}
            className={styles.thumb}
            draggable={false}
          />

          {/* Six frosted-glass chunks of different shapes. */}
          <span className={`${styles.chunk} ${styles.chunk1}`} />
          <span className={`${styles.chunk} ${styles.chunk2}`} />
          <span className={`${styles.chunk} ${styles.chunk3}`} />
          <span className={`${styles.chunk} ${styles.chunk4}`} />
          <span className={`${styles.chunk} ${styles.chunk5}`} />
          <span className={`${styles.chunk} ${styles.chunk6}`} />

          {/* Description sits at the top-left, fades in after the glass
              settles. translateZ pushes it slightly forward so the
              tilt makes it feel like it's floating above the photo. */}
          <span className={styles.info}>
            <span className={styles.cardTitle}>{wallpaper.title}</span>
            <span className={styles.meta}>
              {wallpaper.location} · {wallpaper.year}
            </span>
            <span className={styles.story}>{wallpaper.story}</span>
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

        <button
          type="button"
          className={styles.downloadBtn}
          onClick={() => onDownload(wallpaper)}
          disabled={state === "loading"}
          aria-label={`Download ${wallpaper.title}`}
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
      </motion.div>
    </li>
  );
}
