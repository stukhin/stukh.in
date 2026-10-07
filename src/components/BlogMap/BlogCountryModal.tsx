"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Stack from "@/components/Stack/Stack";
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
 * viewport when a visited country is clicked on /blog. Always
 * exactly three paged spreads (cover · taste · gallery) so the
 * structure is consistent across countries even when data is
 * sparse: empty quadrants and missing photos render explicit
 * empty states instead of suppressing the spread.
 *
 * While the panel is open we set `html.blog-panel-open` to hide
 * the shell chrome it would collide with: the desktop TopNav (same
 * bottom-right area as the pager dots), the burger (same corner as
 * the ×) and, on phones where the panel is full-screen, the logo.
 * Escape or × closes the panel and restores them.
 *
 * Paging via plain CSS scroll-snap on a horizontal flex row: native
 * swipe on touch + smooth wheel on desktop. Arrow keys + the page-
 * dot rail call scrollTo for explicit nav. Inside the taste spread,
 * tapping a chip locks it to a centered card via framer-motion
 * shared layout; backdrop / × / Escape collapses it back to slot.
 */
export default function BlogCountryModal({ visit, onClose }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [lockedRec, setLockedRec] = useState<number | null>(null);

  const spreads: Spread[] = useMemo(
    () => [
      { key: "cover", label: "cover" },
      { key: "taste", label: "places" },
      { key: "gallery", label: "frames" },
    ],
    []
  );

  const issueNumber = useMemo(() => {
    if (!visit) return 0;
    const idx = VISITS.findIndex((v) => v.iso === visit.iso);
    return idx >= 0 ? idx + 1 : 0;
  }, [visit]);

  // Hide the shell chrome (TopNav, burger, phone logo) while the
  // panel is open. Toggles only when the open/closed state flips
  // (not on every country switch), so nothing flickers when
  // navigating between visits.
  const isOpen = !!visit;
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.classList.add("blog-panel-open");
    return () => {
      document.documentElement.classList.remove("blog-panel-open");
    };
  }, [isOpen]);

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
        if (lockedRec !== null) return;
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
                <CoverSpread visit={visit} issue={issueNumber} />
              )}
              {s.key === "taste" && (
                <TasteSpread
                  recommendations={visit.recommendations ?? []}
                  lockedRec={lockedRec}
                  setLockedRec={setLockedRec}
                />
              )}
              {s.key === "gallery" && (
                <GallerySpread photos={visit.photos ?? []} />
              )}
            </section>
          ))}
        </div>

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
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* COVER                                                              */
/* ------------------------------------------------------------------ */

function CoverSpread({ visit, issue }: { visit: Visit; issue: number }) {
  const hero = visit.photos?.[0];
  const framesCount = visit.photos?.length ?? 0;
  const spotsCount = visit.recommendations?.length ?? 0;

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

      <div
        className={`${styles.coverHero} ${!hero ? styles.coverHeroEmpty : ""}`}
        style={hero ? { backgroundImage: `url(${hero.src})` } : undefined}
        role={hero ? "img" : undefined}
        aria-label={hero?.place ?? undefined}
      >
        <div className={styles.coverStamp} aria-hidden="true">
          <span className={styles.stampDates}>{visit.dates}</span>
          <span className={styles.stampLine} />
          <span className={styles.stampTag}>visited</span>
        </div>
      </div>

      <h2 className={styles.coverName}>{visit.name}</h2>

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

      {visit.description && (
        <p className={styles.coverDescription}>{visit.description}</p>
      )}

      <div className={styles.coverCounts}>
        <span>
          {framesCount} frame{framesCount === 1 ? "" : "s"}
        </span>
        <span className={styles.coverCountSep} aria-hidden="true">
          ·
        </span>
        <span>
          {spotsCount} spot{spotsCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TASTE                                                              */
/* ------------------------------------------------------------------ */

type Quadrant = "tl" | "tr" | "bl" | "br";

const CATEGORIES: Array<{
  key: Recommendation["category"];
  icon: string;
  label: string;
  quadrant: Quadrant;
}> = [
  { key: "coffee", icon: "☕", label: "coffee", quadrant: "tl" },
  { key: "nature", icon: "⛰", label: "nature", quadrant: "tr" },
  { key: "food", icon: "🍽", label: "food", quadrant: "bl" },
  { key: "view", icon: "▣", label: "view", quadrant: "br" },
];

const CATEGORY_META = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c])
) as Record<Recommendation["category"], (typeof CATEGORIES)[number]>;

// Per-quadrant scatter. Chips flow in a column inside their own
// quadrant, growing inward from the outer corner — so they can
// never cross the axes or land on top of each other (the old
// absolute %-offsets did both on narrow panels). `nudge` pushes
// each chip a few px in from the outer edge and `rot` tilts it, so
// the column still reads hand-placed.
const QUADRANT_SCATTER: Record<
  Quadrant,
  Array<{ nudge: number; rot: number }>
> = {
  tl: [
    { nudge: 0, rot: -1.5 },
    { nudge: 16, rot: 1.0 },
    { nudge: 4, rot: -0.6 },
    { nudge: 24, rot: 0.4 },
  ],
  tr: [
    { nudge: 0, rot: 1.2 },
    { nudge: 12, rot: -0.8 },
    { nudge: 4, rot: 0.6 },
    { nudge: 20, rot: -1.6 },
  ],
  bl: [
    { nudge: 4, rot: 0.8 },
    { nudge: 20, rot: -1.4 },
    { nudge: 0, rot: 1.6 },
    { nudge: 12, rot: -0.4 },
  ],
  br: [
    { nudge: 4, rot: -0.6 },
    { nudge: 16, rot: 1.2 },
    { nudge: 0, rot: -1.0 },
    { nudge: 24, rot: 0.4 },
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
      Quadrant,
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
        {CATEGORIES.map((cat) => {
          // Label sits in the quadrant's outer corner: first in the
          // column on top, last (under the chips) on the bottom row.
          const isTop = cat.quadrant.includes("t");
          const label = (
            <div className={styles.tasteCornerLabel} aria-hidden="true">
              <span className={styles.tasteCornerIcon}>{cat.icon}</span>
              <span className={styles.tasteCornerText}>{cat.label}</span>
            </div>
          );
          const pool = QUADRANT_SCATTER[cat.quadrant];
          return (
            <div
              key={cat.key}
              className={`${styles.tasteQuadrant} ${styles[`quadrant_${cat.quadrant}`]}`}
              data-category={cat.key}
            >
              {isTop && label}
              <div className={styles.tasteChips}>
                {grouped[cat.quadrant].map(({ rec, i }, k) => (
                  <ChipInQuadrant
                    key={i}
                    rec={rec}
                    index={i}
                    quadrant={cat.quadrant}
                    scatter={pool[k % pool.length]}
                    isHidden={lockedRec === i}
                    onLock={() => setLockedRec(i)}
                  />
                ))}
              </div>
              {!isTop && label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChipInQuadrant({
  rec,
  index,
  quadrant,
  scatter,
  isHidden,
  onLock,
}: {
  rec: Recommendation;
  index: number;
  quadrant: Quadrant;
  scatter: { nudge: number; rot: number };
  isHidden: boolean;
  onLock: () => void;
}) {
  const left = quadrant.includes("l");

  return (
    <motion.button
      type="button"
      layoutId={`chip-${index}`}
      className={`${styles.tasteChip} ${isHidden ? styles.tasteChipHidden : ""}`}
      data-category={rec.category}
      // Tilt goes through motion (not a CSS transform) so hover and
      // the lock/unlock layout animation return to it instead of
      // wiping it to `transform: none`.
      style={{
        [left ? "marginLeft" : "marginRight"]: scatter.nudge,
        transformOrigin: `${left ? "left" : "right"} ${
          quadrant.includes("t") ? "top" : "bottom"
        }`,
        rotate: scatter.rot,
      }}
      onClick={onLock}
      data-cursor="hover"
      whileHover={{ scale: 1.06, rotate: 0 }}
      transition={{ duration: 0.3, ease: [0.65, 0, 0.25, 1] }}
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
        transition={{ duration: 0.5, ease: [0.65, 0, 0.25, 1] }}
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
/* GALLERY — Stack of polaroid-ish photo cards                        */
/* ------------------------------------------------------------------ */

function GallerySpread({ photos }: { photos: Photo[] }) {
  // Memoised: Stack resets its card order whenever it receives a new
  // `cards` array, so an inline .map() would shuffle the pile back on
  // every panel re-render.
  const cards = useMemo(
    () =>
      photos.map((p, i) => {
        const aspectClass =
          p.aspect === "landscape"
            ? styles.galleryStackCardLandscape
            : p.aspect === "square"
            ? styles.galleryStackCardSquare
            : styles.galleryStackCardPortrait;
        return (
          <figure
            key={i}
            className={`${styles.galleryStackCard} ${aspectClass}`}
          >
            <div
              className={styles.galleryStackImage}
              style={{ backgroundImage: `url(${p.src})` }}
              role="img"
              aria-label={p.caption ?? p.place ?? "photograph"}
            />
            {(p.place || p.caption) && (
              <figcaption className={styles.galleryStackCaption}>
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
      }),
    [photos]
  );

  return (
    <div className={styles.gallery}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>frames</span>
        <span className={styles.spreadCount}>{photos.length}</span>
      </header>

      {photos.length === 0 ? (
        <div className={styles.galleryEmpty}>
          <span className={styles.galleryEmptyDash}>—</span>
          <span className={styles.galleryEmptyText}>frames coming soon</span>
        </div>
      ) : (
        <div className={styles.galleryStackWrap}>
          <Stack
            randomRotation
            sensitivity={150}
            sendToBackOnClick
            mobileClickOnly
            cards={cards}
          />
        </div>
      )}
    </div>
  );
}
