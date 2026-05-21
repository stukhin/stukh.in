"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence } from "motion/react";
import WallpaperHoverPlate, {
  type HoverState,
} from "./WallpaperHoverPlate";
import WallpaperCard from "./WallpaperCard";
import FilterDropdown from "./FilterDropdown";
import { useSmoothScroll } from "@/lib/useSmoothScroll";
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

export default function WallsGallery({ items }: Props) {
  // Lerp wheel-driven scroll on /walls so paging through the
  // wallpaper grid eases instead of jumping with native steps.
  // Releases events at the document edge so useDesktopPageWheel
  // still gets clean events to nav between routes.
  useSmoothScroll();
  // Fade the filter row out as soon as the user scrolls — the
  // wallpapers slide up over the filters' fixed position and the
  // overlap reads as a visual collision. Show again only when the
  // page returns to the very top.
  const [filtersHidden, setFiltersHidden] = useState(false);
  useEffect(() => {
    const HIDE_AT = 40;
    const onScroll = () => setFiltersHidden(window.scrollY > HIDE_AT);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [zoomed, setZoomed] = useState<Wallpaper | null>(null);
  const [zoomClosing, setZoomClosing] = useState(false);
  const [zoomReady, setZoomReady] = useState(false);
  const [zoomInfoOpen, setZoomInfoOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [activeTone, setActiveTone] = useState<string>(ALL_TONE);
  const [hover, setHover] = useState<HoverState | null>(null);

  const cardImgRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const modalImgRef = useRef<HTMLImageElement>(null);
  const fromRectRef = useRef<DOMRect | null>(null);
  /** Focus-trap anchors for the zoom modal. trigger = the card
   *  button that opened the zoom (restored on close); dialog =
   *  the modal root (focus pinned inside on Tab cycling). */
  const zoomTriggerRef = useRef<Element | null>(null);
  const zoomDialogRef = useRef<HTMLDivElement>(null);

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
    setZoomInfoOpen(false);
    setZoomed(w);
  };

  const closeZoom = useCallback(() => {
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
  }, [zoomed, zoomClosing]);

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
    // Snapshot whatever had focus when the zoom opened so we can
    // return to it on close. Defer the in-modal focus by one frame
    // so the FLIP entrance has the dialog laid out before we grab.
    zoomTriggerRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      const root = zoomDialogRef.current;
      if (!root) return;
      const firstBtn = root.querySelector<HTMLButtonElement>(
        "button:not([disabled])"
      );
      firstBtn?.focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeZoom();
        return;
      }
      if (e.key !== "Tab") return;
      const root = zoomDialogRef.current;
      if (!root) return;
      const list = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !root.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("hidden");
      document.documentElement.classList.remove("zoom-open");
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(focusTimer);
      const trigger = zoomTriggerRef.current as HTMLElement | null;
      if (
        trigger &&
        typeof trigger.focus === "function" &&
        document.contains(trigger) &&
        document.activeElement !== trigger
      ) {
        trigger.focus({ preventScroll: true });
      }
      zoomTriggerRef.current = null;
    };
  }, [zoomed, closeZoom]);

  return (
    <>
      <div className={styles.layout}>
        <div
          className={`${styles.filters} ${
            filtersHidden ? styles.filtersHidden : ""
          }`}
        >
          <FilterDropdown
            label="type"
            value={activeCategory}
            onChange={setActiveCategory}
            options={categories.map((cat) => ({
              value: cat,
              label: cat.toLowerCase(),
            }))}
          />
          {tones.length > 1 && (
            <FilterDropdown
              label="color"
              value={activeTone}
              onChange={setActiveTone}
              options={tones.map((t) => ({
                value: t,
                label: TONE_LABELS[t] || t.toLowerCase(),
                color: TONE_HOVER_COLORS[t],
              }))}
            />
          )}
        </div>

        <ul className={styles.grid}>
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleItems.map((w) => {
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
                />
              );
            })}
          </AnimatePresence>
        </ul>
      </div>

      <WallpaperHoverPlate hover={hover} />

      {zoomed && (
        <div
          ref={zoomDialogRef}
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
            {/* Action group, bottom-right of the photo. ALWAYS
                visible (no hover gating) on every breakpoint —
                user wanted the affordance to never appear/
                disappear because it's confusing on touch. The
                info button toggles a metadata panel; the
                download button kicks off the actual download. */}
            <div className={styles.zoomActions}>
              <button
                type="button"
                className={`${styles.zoomAction} ${
                  zoomInfoOpen ? styles.zoomActionPressed : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomInfoOpen((v) => !v);
                }}
                aria-label={zoomInfoOpen ? "Hide info" : "Show info"}
                aria-pressed={zoomInfoOpen}
                data-cursor="hover"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v6" strokeLinecap="round" />
                  <circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className={styles.zoomAction}
                onClick={(e) => {
                  e.stopPropagation();
                  download(zoomed);
                }}
                disabled={(downloads[zoomed.id] || "idle") === "loading"}
                aria-label={`Download ${zoomed.title}`}
                data-cursor="hover"
              >
                <svg
                  width="20"
                  height="20"
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
            {/* Metadata panel — slides in over the photo when info
                is toggled. Carries everything the on-card
                interaction used to surface (title, location/year,
                story); the download count is also shown so the
                user can see how many people grabbed this one. */}
            {zoomInfoOpen && (
              <div
                className={styles.zoomInfoPanel}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className={styles.zoomInfoTitle}>{zoomed.title}</h3>
                <p className={styles.zoomInfoMeta}>
                  {zoomed.location} · {zoomed.year}
                </p>
                {zoomed.story && (
                  <p className={styles.zoomInfoStory}>{zoomed.story}</p>
                )}
                <p className={styles.zoomInfoCount}>
                  {(counts[zoomed.id] ?? zoomed.downloads).toLocaleString()}{" "}
                  downloads
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
