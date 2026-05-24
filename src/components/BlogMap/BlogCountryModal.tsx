"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import type { Visit, Recommendation, Photo } from "./visits";
import { VISITS } from "./visits";
import styles from "./BlogCountryModal.module.css";

type Props = {
  visit: Visit | null;
  onClose: () => void;
};

type SpreadKey = "cover" | "taste" | "gallery";

type Spread = {
  key: SpreadKey;
  label: string;
};

/**
 * Country "field notebook" — slides in from the right of the
 * viewport when a visited country is clicked on /blog. Three paged
 * spreads instead of a vertical dossier:
 *
 *   1. cover   — issue meta, hero photo, name, dates + city count,
 *                description, trip facts row, preview thumbnails
 *                (clickable, jumps to gallery).
 *   2. taste   — recommendations on a 4-quadrant flavour grid
 *                (coffee · nature · food · view). Each chip grows
 *                on hover; click locks it to a centered card with
 *                photo + note; click backdrop or × collapses it
 *                back to its quadrant slot via shared layout.
 *   3. gallery — contact-print grid of all photos, slight per-print
 *                rotation, hover straightens.
 *
 * Paging is plain CSS scroll-snap on a horizontal flex row, which
 * gives free native swipe on touch + smooth wheel on desktop. Arrow
 * keys + the page-dot rail call `scrollTo` for explicit nav.
 */
export default function BlogCountryModal({ visit, onClose }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [lockedRec, setLockedRec] = useState<number | null>(null);

  const spreads = useMemo<Spread[]>(() => {
    if (!visit) return [];
    const list: Spread[] = [{ key: "cover", label: "cover" }];
    if (visit.recommendations && visit.recommendations.length > 0) {
      list.push({ key: "taste", label: "places" });
    }
    if (visit.photos && visit.photos.length > 0) {
      list.push({ key: "gallery", label: "frames" });
    }
    return list;
  }, [visit]);

  const issueNumber = useMemo(() => {
    if (!visit) return 0;
    const idx = VISITS.findIndex((v) => v.iso === visit.iso);
    return idx >= 0 ? idx + 1 : 0;
  }, [visit]);

  // Snap-scroll position → active page (rAF-throttled).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollLeft / el.clientWidth);
        setActivePage((prev) => (prev === idx ? prev : idx));
        raf = 0;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visit?.iso]);

  // Escape closes (or collapses a locked chip first); ←/→ pages.
  useEffect(() => {
    if (!visit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (lockedRec !== null) {
          setLockedRec(null);
        } else {
          onClose();
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (lockedRec !== null) return; // don't page while a card is locked
        const el = scrollerRef.current;
        if (!el) return;
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const next = Math.max(
          0,
          Math.min(spreads.length - 1, activePage + dir)
        );
        el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visit, onClose, activePage, spreads.length, lockedRec]);

  // New visit → snap back to page 1, drop any locked chip.
  useEffect(() => {
    setActivePage(0);
    setLockedRec(null);
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: 0, behavior: "auto" });
  }, [visit?.iso]);

  if (!visit) return null;

  const goToPage = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const tasteIndex = spreads.findIndex((s) => s.key === "taste");
  const galleryIndex = spreads.findIndex((s) => s.key === "gallery");

  return (
    <aside
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-label={`${visit.name} notebook`}
      data-blog-country-panel
    >
      <button
        type="button"
        className={styles.close}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close"
        data-cursor="hover"
      >
        ×
      </button>

      {activePage > 0 && (
        <div className={styles.footerTitle} aria-hidden="true">
          {visit.name} · {spreads[activePage]?.label}
        </div>
      )}

      <LayoutGroup id={`notebook-${visit.iso}`}>
        <div className={styles.scroller} ref={scrollerRef}>
          {spreads.map((s) => (
            <section
              key={s.key}
              className={styles.spread}
              data-spread={s.key}
              aria-label={`${visit.name} — ${s.label}`}
            >
              {s.key === "cover" && (
                <CoverSpread
                  visit={visit}
                  issue={issueNumber}
                  onJumpTaste={
                    tasteIndex >= 0 ? () => goToPage(tasteIndex) : undefined
                  }
                  onJumpGallery={
                    galleryIndex >= 0
                      ? () => goToPage(galleryIndex)
                      : undefined
                  }
                />
              )}
              {s.key === "taste" && (
                <TasteSpread
                  recommendations={visit.recommendations!}
                  lockedRec={lockedRec}
                  setLockedRec={setLockedRec}
                />
              )}
              {s.key === "gallery" && (
                <GallerySpread photos={visit.photos!} />
              )}
            </section>
          ))}
        </div>

        {/* Locked chip overlay — lives outside the scroller so it
            fills the whole panel without inheriting scroll-snap. */}
        <AnimatePresence>
          {lockedRec !== null && visit.recommendations?.[lockedRec] && (
            <LockedChipOverlay
              rec={visit.recommendations[lockedRec]}
              index={lockedRec}
              onClose={() => setLockedRec(null)}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>

      {spreads.length > 1 && (
        <nav className={styles.pager} aria-label="notebook spreads">
          {spreads.map((s, i) => (
            <button
              key={s.key}
              type="button"
              className={`${styles.dot} ${i === activePage ? styles.dotActive : ""}`}
              aria-label={`go to ${s.label}`}
              aria-current={i === activePage ? "page" : undefined}
              data-cursor="hover"
              onClick={() => goToPage(i)}
            >
              <span className={styles.dotLabel}>{s.label}</span>
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* COVER                                                              */
/* ------------------------------------------------------------------ */

function CoverSpread({
  visit,
  issue,
  onJumpTaste,
  onJumpGallery,
}: {
  visit: Visit;
  issue: number;
  onJumpTaste?: () => void;
  onJumpGallery?: () => void;
}) {
  const hero = visit.photos?.[0];
  const previewThumbs = (visit.photos ?? []).slice(0, 6);

  return (
    <div className={styles.cover}>
      <div className={styles.coverMeta}>
        <span className={styles.coverIssue}>
          № {String(issue).padStart(2, "0")}
        </span>
        <span className={styles.coverFlag} aria-hidden="true">
          {visit.flag}
        </span>
      </div>

      {hero ? (
        <div
          className={styles.coverHero}
          style={{ backgroundImage: `url(${hero.src})` }}
          role="img"
          aria-label={hero.place ?? `${visit.name} hero`}
        >
          <div className={styles.coverStamp} aria-hidden="true">
            <span className={styles.stampDates}>{visit.dates}</span>
            <span className={styles.stampLine} />
            <span className={styles.stampTag}>visited</span>
          </div>
        </div>
      ) : (
        <div className={styles.coverHeroEmpty} aria-hidden="true">
          <div className={styles.coverStamp}>
            <span className={styles.stampDates}>{visit.dates}</span>
            <span className={styles.stampLine} />
            <span className={styles.stampTag}>visited</span>
          </div>
        </div>
      )}

      <h2 className={styles.coverName}>{visit.name}</h2>

      {visit.description && (
        <p className={styles.coverDescription}>{visit.description}</p>
      )}

      <dl className={styles.coverFacts}>
        <div className={styles.fact}>
          <dt>cities</dt>
          <dd>{visit.cities.length}</dd>
        </div>
        <div className={styles.fact}>
          <dt>frames</dt>
          <dd>{visit.photos?.length ?? 0}</dd>
        </div>
        <div className={styles.fact}>
          <dt>spots</dt>
          <dd>{visit.recommendations?.length ?? 0}</dd>
        </div>
      </dl>

      {visit.cities.length > 0 && (
        <div className={styles.coverCities}>
          {visit.cities.map((c, i) => (
            <span key={c} className={styles.coverCity}>
              {c}
              {i < visit.cities.length - 1 && (
                <span className={styles.coverCitySep} aria-hidden="true">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {(onJumpTaste || onJumpGallery) && (
        <nav className={styles.coverJumps} aria-label="jump to spread">
          {onJumpTaste && (
            <button
              type="button"
              className={styles.coverJump}
              onClick={onJumpTaste}
              data-cursor="hover"
            >
              <span className={styles.coverJumpKicker}>↘ places</span>
              <span className={styles.coverJumpHint}>
                taste map of {visit.recommendations?.length ?? 0} spots
              </span>
            </button>
          )}
          {onJumpGallery && previewThumbs.length > 0 && (
            <button
              type="button"
              className={styles.coverJumpGallery}
              onClick={onJumpGallery}
              data-cursor="hover"
              aria-label="open frames"
            >
              <span className={styles.coverJumpKicker}>↘ frames</span>
              <div className={styles.coverThumbRow}>
                {previewThumbs.map((p, i) => (
                  <span
                    key={i}
                    className={styles.coverThumb}
                    style={{ backgroundImage: `url(${p.src})` }}
                  />
                ))}
              </div>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TASTE — 4-quadrant flavour grid with click-to-lock chips           */
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<
  Recommendation["category"],
  { icon: string; label: string; quadrant: "tl" | "tr" | "bl" | "br" }
> = {
  coffee: { icon: "☕", label: "coffee", quadrant: "tl" },
  nature: { icon: "⛰", label: "nature", quadrant: "tr" },
  food: { icon: "🍽", label: "food", quadrant: "bl" },
  view: { icon: "▣", label: "view", quadrant: "br" },
};

// Per-quadrant anchor offsets. `major` is the distance from the
// quadrant's outer (corner) edge along the long axis; `minor` is
// along the short axis. Each chip is positioned via `left|right` +
// `top|bottom` % matching its quadrant so it cannot overflow the
// canvas no matter how wide its content gets.
const QUADRANT_OFFSETS: Record<
  "tl" | "tr" | "bl" | "br",
  Array<{ x: number; y: number; rot: number }>
> = {
  tl: [
    { x: 8, y: 22, rot: -1.5 },
    { x: 22, y: 50, rot: 1.0 },
    { x: 4, y: 78, rot: -0.6 },
    { x: 32, y: 32, rot: 0.4 },
  ],
  tr: [
    { x: 6, y: 24, rot: 1.2 },
    { x: 18, y: 52, rot: -0.8 },
    { x: 4, y: 78, rot: 0.6 },
    { x: 26, y: 36, rot: -1.6 },
  ],
  bl: [
    { x: 6, y: 26, rot: 0.8 },
    { x: 22, y: 52, rot: -1.4 },
    { x: 4, y: 78, rot: 1.6 },
    { x: 30, y: 36, rot: -0.4 },
  ],
  br: [
    { x: 6, y: 24, rot: -0.6 },
    { x: 20, y: 50, rot: 1.2 },
    { x: 4, y: 76, rot: -1.0 },
    { x: 28, y: 34, rot: 0.4 },
  ],
};

function TasteSpread({
  recommendations,
  lockedRec,
  setLockedRec,
}: {
  recommendations: Recommendation[];
  lockedRec: number | null;
  setLockedRec: (i: number | null) => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<
      "tl" | "tr" | "bl" | "br",
      Array<{ rec: Recommendation; i: number }>
    > = { tl: [], tr: [], bl: [], br: [] };
    recommendations.forEach((rec, i) => {
      groups[CATEGORY_META[rec.category].quadrant].push({ rec, i });
    });
    return groups;
  }, [recommendations]);

  return (
    <div className={styles.taste}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>taste map</span>
        <span className={styles.spreadCount}>{recommendations.length}</span>
      </header>

      <div className={styles.tasteCanvas}>
        <div className={styles.tasteAxisH} aria-hidden="true" />
        <div className={styles.tasteAxisV} aria-hidden="true" />

        {(Object.entries(CATEGORY_META) as Array<
          [Recommendation["category"], (typeof CATEGORY_META)[Recommendation["category"]]]
        >).map(([cat, meta]) => (
          <div
            key={cat}
            className={`${styles.tasteCornerLabel} ${styles[`corner_${meta.quadrant}`]}`}
            data-category={cat}
            aria-hidden="true"
          >
            <span className={styles.tasteCornerIcon}>{meta.icon}</span>
            <span className={styles.tasteCornerText}>{meta.label}</span>
          </div>
        ))}

        {(
          Object.entries(grouped) as Array<
            ["tl" | "tr" | "bl" | "br", Array<{ rec: Recommendation; i: number }>]
          >
        ).map(([quadrant, items]) =>
          items.map(({ rec, i }, indexInQuadrant) => {
            const pool = QUADRANT_OFFSETS[quadrant];
            const offset = pool[indexInQuadrant % pool.length];
            return (
              <ChipInQuadrant
                key={i}
                rec={rec}
                index={i}
                quadrant={quadrant}
                offset={offset}
                isHidden={lockedRec === i}
                onLock={() => setLockedRec(i)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function ChipInQuadrant({
  rec,
  index,
  quadrant,
  offset,
  isHidden,
  onLock,
}: {
  rec: Recommendation;
  index: number;
  quadrant: "tl" | "tr" | "bl" | "br";
  offset: { x: number; y: number; rot: number };
  isHidden: boolean;
  onLock: () => void;
}) {
  // Anchor each chip from its quadrant's outer corner so growing
  // chips expand AWAY from the centre cross and CAN'T overflow the
  // canvas no matter what's inside them.
  const positionStyle: React.CSSProperties = {
    [quadrant.includes("l") ? "left" : "right"]: `${offset.x}%`,
    [quadrant.includes("t") ? "top" : "bottom"]: `${offset.y}%`,
    transformOrigin: `${quadrant.includes("l") ? "left" : "right"} ${
      quadrant.includes("t") ? "top" : "bottom"
    }`,
  };

  return (
    <motion.button
      type="button"
      layoutId={`chip-${index}`}
      className={`${styles.tasteChip} ${isHidden ? styles.tasteChipHidden : ""}`}
      data-category={rec.category}
      style={{ ...positionStyle, ["--rot" as string]: `${offset.rot}deg` }}
      onClick={onLock}
      data-cursor="hover"
      // Hover-grow: scale + lift via spring.
      whileHover={{ scale: 1.06, rotate: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <motion.span layout="position" className={styles.tasteChipName}>
        {rec.name}
      </motion.span>
      {rec.city && (
        <motion.span layout="position" className={styles.tasteChipCity}>
          {rec.city}
        </motion.span>
      )}
    </motion.button>
  );
}

function LockedChipOverlay({
  rec,
  index,
  onClose,
}: {
  rec: Recommendation;
  index: number;
  onClose: () => void;
}) {
  // Trap clicks on the card itself so backdrop dismiss only fires
  // from genuine outside clicks.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <motion.div
      className={styles.lockedBackdrop}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        layoutId={`chip-${index}`}
        className={`${styles.tasteChip} ${styles.lockedChip}`}
        data-category={rec.category}
        onClick={stop}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
      >
        {rec.photo && (
          <div
            className={styles.lockedPhoto}
            style={{ backgroundImage: `url(${rec.photo})` }}
            role="img"
            aria-label={rec.name}
          />
        )}
        <div className={styles.lockedBody}>
          <div className={styles.lockedCategory}>
            <span className={styles.lockedCategoryIcon}>
              {CATEGORY_META[rec.category].icon}
            </span>
            <span className={styles.lockedCategoryLabel}>
              {CATEGORY_META[rec.category].label}
              {rec.city ? ` · ${rec.city}` : ""}
            </span>
          </div>
          <div className={styles.lockedName}>{rec.name}</div>
          {rec.note && <p className={styles.lockedNote}>{rec.note}</p>}
        </div>
        <button
          type="button"
          className={styles.lockedClose}
          onClick={onClose}
          aria-label="Close"
          data-cursor="hover"
        >
          ×
        </button>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* GALLERY — contact prints in a slightly tilted grid                 */
/* ------------------------------------------------------------------ */

const PRINT_ROTATIONS = [-2.4, 1.6, -0.8, 2.2, -1.4, 1.0, -2.0, 0.6];

function GallerySpread({ photos }: { photos: Photo[] }) {
  return (
    <div className={styles.gallery}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>frames</span>
        <span className={styles.spreadCount}>{photos.length}</span>
      </header>

      <div className={styles.galleryGrid}>
        {photos.map((p, i) => {
          const rot = PRINT_ROTATIONS[i % PRINT_ROTATIONS.length];
          return (
            <figure
              key={i}
              className={styles.print}
              style={{ ["--rot" as string]: `${rot}deg` }}
            >
              <div
                className={styles.printImage}
                style={{ backgroundImage: `url(${p.src})` }}
                role="img"
                aria-label={p.caption ?? p.place ?? "photograph"}
              />
              {(p.place || p.caption) && (
                <figcaption className={styles.printCaption}>
                  {p.place && (
                    <span className={styles.printPlace}>{p.place}</span>
                  )}
                  {p.caption && (
                    <span className={styles.printNote}>{p.caption}</span>
                  )}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}
