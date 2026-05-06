"use client";

import {
  CSSProperties,
  MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
} from "motion/react";
import { useMobileScrollFocus } from "@/lib/useMobileScrollFocus";
import WallpaperHoverPlate, {
  type HoverState,
} from "./WallpaperHoverPlate";
import styles from "./WallsGallery.module.css";

export type Wallpaper = {
  id: string;
  title: string;
  location: string;
  year: number;
  story: string;
  downloads: number;
  category: string;
  tone?: string;
};

const ALL_TONE = "All";
const TONE_ORDER = ["All", "BW", "Warm", "Cool", "Earth", "Soft"];
const TONE_LABELS: Record<string, string> = {
  All: "all",
  BW: "b & w",
  Warm: "warm",
  Cool: "cool",
  Earth: "earth",
  Soft: "soft",
};
// Per-tone hover/active accent. `All` falls back to plain white so the
// "all" tone item reads exactly like the "all" category item above the
// divider. Each colour is tuned to feel like its label against the
// dark page background — warm amber, cool steel-blue, etc.
const TONE_HOVER_COLORS: Record<string, string> = {
  All: "#ffffff",
  BW: "#ffffff",
  Warm: "#f4c282",
  Cool: "#a3c4dc",
  Earth: "#c4b88a",
  Soft: "#e0c8d8",
};

type DownloadState = "idle" | "loading" | "done";

type Props = {
  items: Wallpaper[];
};

const ALL = "All";
// Slower, more deliberate FLIP: a touch of ease-in at the start, slow
// growth through the middle, soft deceleration at the end.
const ZOOM_IN_MS = 750;
const ZOOM_OUT_MS = 550;
const ZOOM_EASING = "cubic-bezier(0.65, 0, 0.25, 1)";
const TILT_AMPLITUDE = 9;
const SPRING = { damping: 30, stiffness: 100, mass: 1.4 };

export default function WallsGallery({ items }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const [zoomReady, setZoomReady] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeTone, setActiveTone] = useState<string>(ALL_TONE);
  const [hover, setHover] = useState<HoverState | null>(null);

  const cardImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const cardElRefs = useRef<(HTMLLIElement | null)[]>([]);
  const modalImgRef = useRef<HTMLImageElement>(null);
  const fromRectRef = useRef<DOMRect | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((w) => set.add(w.category));
    return [ALL, ...Array.from(set).sort()];
  }, [items]);

  const tones = useMemo(() => {
    const present = new Set<string>();
    items.forEach((w) => {
      if (w.tone) present.add(w.tone);
    });
    return TONE_ORDER.filter((t) => t === ALL_TONE || present.has(t));
  }, [items]);

  const visibleItems = useMemo(
    () =>
      items.filter(
        (w) =>
          (activeCategory === ALL || w.category === activeCategory) &&
          (activeTone === ALL_TONE || w.tone === activeTone)
      ),
    [items, activeCategory, activeTone]
  );

  // Mobile-only: row currently centred in the viewport renders at
  // full 9:16 height; rows above/below taper smoothly to a quarter,
  // and the magnet snap pulls the nearest row to centre on each
  // scroll-end. No-ops on wider viewports.
  useMobileScrollFocus(cardElRefs, 2, visibleItems.length);

  // Desktop hover-plate plumbing. Cards fire enter/leave; the
  // download button fires its own pair on top so the plate can
  // include the format hint when the user is over it.
  const onCardEnter = (w: Wallpaper) =>
    setHover({ wallpaper: w, isHoveringDownload: false });
  const onCardLeave = () => setHover(null);
  const onDownloadEnter = () =>
    setHover((prev) => (prev ? { ...prev, isHoveringDownload: true } : prev));
  const onDownloadLeave = () =>
    setHover((prev) => (prev ? { ...prev, isHoveringDownload: false } : prev));

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
      // Serve JPG: more phone OSes accept it as a wallpaper file
      // (notably iOS, which won't take .webp).
      const res = await fetch(`/images/walls/${w.id}.jpg`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stukhin-${w.id}.jpg`;
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
    setZoomReady(false);
    setZoomed(w);
  };

  const closeZoom = () => {
    if (!zoomed || zoomClosing) return;
    // Hide the Download button immediately as the photo starts
    // shrinking back — no chance to flash it during the close.
    setZoomReady(false);
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
      // Web Animations API: reliable single-shot animation that
      // doesn't depend on transition/style timing tricks.
      modalImg.animate(
        [
          { transform: "translate(0px, 0px) scale(1)" },
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        ],
        {
          duration: ZOOM_OUT_MS,
          easing: ZOOM_EASING,
          fill: "forwards",
        }
      );
    }
    setZoomClosing(true);
    window.setTimeout(() => {
      setZoomed(null);
      setZoomClosing(false);
    }, ZOOM_OUT_MS);
  };

  // Run the FLIP morph as soon as the modal img mounts. Use the
  // Web Animations API directly — more reliable than juggling CSS
  // transitions across React renders.
  useLayoutEffect(() => {
    if (!zoomed || zoomClosing) return;
    const modalImg = modalImgRef.current;
    const from = fromRectRef.current;
    if (!modalImg || !from) return;
    const target = modalImg.getBoundingClientRect();
    if (!target.width || !target.height) return;
    const dx =
      from.left + from.width / 2 - (target.left + target.width / 2);
    const dy =
      from.top + from.height / 2 - (target.top + target.height / 2);
    const scale = from.width / target.width;
    modalImg.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      {
        duration: ZOOM_IN_MS,
        easing: ZOOM_EASING,
        fill: "forwards",
      }
    );
    // Reveal the Download button only once the photo has finished
    // its grow-into-place animation.
    const readyTimer = window.setTimeout(() => setZoomReady(true), ZOOM_IN_MS);
    return () => window.clearTimeout(readyTimer);
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
          {tones.length > 1 && (
            <ul className={`${styles.catList} ${styles.toneList}`}>
              {tones.map((t) => {
                const isActive = t === activeTone;
                return (
                  <li key={t}>
                    <button
                      type="button"
                      className={`${styles.catBtn} ${styles.toneBtn} ${
                        isActive ? styles.toneActive : ""
                      }`}
                      style={
                        {
                          "--tone-color": TONE_HOVER_COLORS[t],
                        } as CSSProperties
                      }
                      onClick={() => setActiveTone(t)}
                    >
                      {TONE_LABELS[t] || t.toLowerCase()}
                      <span className={styles.catUnderline} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <ul className={styles.grid}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleItems.map((w, i) => {
              const state = downloads[w.id] || "idle";
              return (
                <WallpaperCard
                  key={w.id}
                  wallpaper={w}
                  state={state}
                  isZoomed={zoomed?.id === w.id}
                  onZoom={openZoom}
                  onDownload={download}
                  onCardEnter={onCardEnter}
                  onCardLeave={onCardLeave}
                  onDownloadEnter={onDownloadEnter}
                  onDownloadLeave={onDownloadLeave}
                  registerImg={(el) => {
                    cardImgRefs.current[w.id] = el;
                  }}
                  registerCard={(el) => {
                    cardElRefs.current[i] = el;
                  }}
                />
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <WallpaperHoverPlate hover={hover} />

      {zoomed && (
        <div
          className={`${styles.zoom} ${zoomClosing ? styles.zoomClosing : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomed.title} preview`}
          onClick={closeZoom}
        >
          <div
            className={`${styles.photoBox} ${
              zoomReady ? styles.photoBoxReady : ""
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              ref={modalImgRef}
              src={`/images/walls/${zoomed.id}.webp`}
              alt={zoomed.title}
              className={styles.zoomImage}
              draggable={false}
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
        </div>
      )}
    </>
  );
}

type CardProps = {
  wallpaper: Wallpaper;
  state: DownloadState;
  isZoomed: boolean;
  onZoom: (w: Wallpaper) => void;
  onDownload: (w: Wallpaper) => void;
  registerImg: (el: HTMLImageElement | null) => void;
  /**
   * Optional callback the parent uses to collect a ref to each
   * card's <li>. The mobile scroll-focus hook needs these refs to
   * compute per-row heights based on viewport-centre distance.
   */
  registerCard?: (el: HTMLLIElement | null) => void;
  /**
   * Desktop hover-plate hooks. The card forwards mouseenter /
   * mouseleave so the parent can render a frosted plate next to the
   * cursor; the download button has its own enter/leave so the plate
   * can swap to a "format hint" variant when the user is over it.
   */
  onCardEnter?: (w: Wallpaper) => void;
  onCardLeave?: () => void;
  onDownloadEnter?: () => void;
  onDownloadLeave?: () => void;
};

function WallpaperCard({
  wallpaper,
  state,
  isZoomed,
  onZoom,
  onDownload,
  registerImg,
  registerCard,
  onCardEnter,
  onCardLeave,
  onDownloadEnter,
  onDownloadLeave,
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
    onCardEnter?.(wallpaper);
  }

  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
    onCardLeave?.();
  }

  return (
    <motion.li
      ref={(el) => {
        ref.current = el;
        registerCard?.(el);
      }}
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={`${styles.card} ${isZoomed ? styles.cardZoomed : ""}`}
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

          {/* All on-card overlays (chunks, info, specs) were lifted
              out into the cursor-following <WallpaperHoverPlate> on
              desktop — keeps the photo clean and the metadata where
              the eye already is. The loader / saved toast still need
              to render on the card itself because they're per-card
              progress feedback. */}
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
          onMouseEnter={onDownloadEnter}
          onMouseLeave={onDownloadLeave}
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
    </motion.li>
  );
}
