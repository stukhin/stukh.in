"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Visit, Recommendation, Photo, CityPin, DispatchEntry } from "./visits";
import { VISITS } from "./visits";
import { buildCountryProjection } from "./countryProjection";
import styles from "./BlogCountryModal.module.css";

type Props = {
  visit: Visit | null;
  onClose: () => void;
};

type SpreadKey = "cover" | "sheet" | "taste" | "map" | "notes";

type Spread = {
  key: SpreadKey;
  label: string;
};

/**
 * Country "field notebook" — slides in from the right of the
 * viewport when a visited country is clicked on /blog. Instead of a
 * vertical text dossier (the v0 dossier read as AI-generated), the
 * panel is a HORIZONTAL set of paged spreads: cover, contact sheet,
 * taste-map, country-map, dispatch notes. Each spread is its own
 * micro-layout — no shared subheaders, no Wikipedia-shaped tower.
 *
 * Paging is plain CSS scroll-snap on a flex row, which gives free
 * native swipe on touch + smooth wheel on desktop. Arrow keys + the
 * page-dot rail call `scrollTo` for explicit nav.
 *
 * Spreads are conditional on data presence: a country with only
 * `description` shows just the cover, one with photos adds the
 * sheet, etc. The notebook stays the same shape; it just gets
 * thinner for less-documented trips.
 */
export default function BlogCountryModal({ visit, onClose }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);

  const spreads = useMemo<Spread[]>(() => {
    if (!visit) return [];
    const list: Spread[] = [{ key: "cover", label: "cover" }];
    if (visit.photos && visit.photos.length > 0) {
      list.push({ key: "sheet", label: "sheet" });
    }
    if (visit.recommendations && visit.recommendations.length > 0) {
      list.push({ key: "taste", label: "taste" });
    }
    if (visit.cityPins && visit.cityPins.length > 0) {
      list.push({ key: "map", label: "map" });
    }
    if (visit.dispatch && visit.dispatch.length > 0) {
      list.push({ key: "notes", label: "notes" });
    }
    return list;
  }, [visit]);

  // Visit index across the whole world — used as the "issue number"
  // on the cover. Stable across renders because VISITS is a module
  // const, but recomputing here keeps the data flow obvious.
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

  // Escape closes; Arrow Left/Right pages.
  useEffect(() => {
    if (!visit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const el = scrollerRef.current;
        if (!el) return;
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const next = Math.max(0, Math.min(spreads.length - 1, activePage + dir));
        el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visit, onClose, activePage, spreads.length]);

  // New visit → snap back to page 1 with no animation.
  useEffect(() => {
    setActivePage(0);
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

      {/* spread title footer (mirrors the page indicator) — shows
          which spread we're on when not on the cover. */}
      {activePage > 0 && (
        <div className={styles.footerTitle} aria-hidden="true">
          {visit.name} · {spreads[activePage]?.label}
        </div>
      )}

      <div className={styles.scroller} ref={scrollerRef}>
        {spreads.map((s) => (
          <section
            key={s.key}
            className={styles.spread}
            data-spread={s.key}
            aria-label={`${visit.name} — ${s.label}`}
          >
            {s.key === "cover" && (
              <CoverSpread visit={visit} issue={issueNumber} onAdvance={() => goToPage(1)} />
            )}
            {s.key === "sheet" && <SheetSpread photos={visit.photos!} />}
            {s.key === "taste" && <TasteSpread recommendations={visit.recommendations!} />}
            {s.key === "map" && <CountryMapSpread iso={visit.iso} pins={visit.cityPins!} />}
            {s.key === "notes" && <NotesSpread entries={visit.dispatch!} />}
          </section>
        ))}
      </div>

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
  onAdvance,
}: {
  visit: Visit;
  issue: number;
  onAdvance: () => void;
}) {
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

      <h2 className={styles.coverName}>{visit.name}</h2>

      <div className={styles.coverStampWrap} aria-hidden="true">
        <div className={styles.coverStamp}>
          <span className={styles.stampDates}>{visit.dates}</span>
          <span className={styles.stampLine} />
          <span className={styles.stampTag}>visited</span>
        </div>
      </div>

      {visit.description && (
        <p className={styles.coverDescription}>{visit.description}</p>
      )}

      <dl className={styles.coverFacts}>
        <div className={styles.fact}>
          <dt>cities</dt>
          <dd>{visit.cities.length}</dd>
        </div>
        {visit.photos && (
          <div className={styles.fact}>
            <dt>frames</dt>
            <dd>{visit.photos.length}</dd>
          </div>
        )}
        {visit.recommendations && (
          <div className={styles.fact}>
            <dt>spots</dt>
            <dd>{visit.recommendations.length}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        className={styles.coverAdvance}
        onClick={onAdvance}
        data-cursor="hover"
        aria-label="next spread"
      >
        open notebook →
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SHEET — contact-print grid on a corkboard                          */
/* ------------------------------------------------------------------ */

// A handful of tiny stable rotations so prints feel hand-arranged
// without re-rolling between renders. Picked once, looped via modulo.
const PRINT_ROTATIONS = [-2.4, 1.6, -0.8, 2.2, -1.4, 1.0, -2.0, 0.6];

function SheetSpread({ photos }: { photos: Photo[] }) {
  return (
    <div className={styles.sheet}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>contact sheet</span>
        <span className={styles.spreadCount}>{photos.length}</span>
      </header>

      <div className={styles.sheetGrid}>
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
                  {p.place && <span className={styles.printPlace}>{p.place}</span>}
                  {p.caption && <span className={styles.printNote}>{p.caption}</span>}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TASTE — recommendations on a 4-quadrant flavour grid               */
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

// Stable per-quadrant chip offsets so the layout doesn't shuffle on
// re-render. Each quadrant gets its own small pool; we index into
// it modulo length so quadrants with 4+ chips just wrap.
const QUADRANT_OFFSETS: Record<
  "tl" | "tr" | "bl" | "br",
  Array<{ x: number; y: number; rot: number }>
> = {
  tl: [
    { x: 18, y: 22, rot: -1.5 },
    { x: 34, y: 50, rot: 1.0 },
    { x: 10, y: 70, rot: -0.6 },
    { x: 46, y: 30, rot: 0.4 },
  ],
  tr: [
    { x: 62, y: 18, rot: 1.2 },
    { x: 76, y: 44, rot: -0.8 },
    { x: 56, y: 64, rot: 0.6 },
    { x: 84, y: 28, rot: -1.6 },
  ],
  bl: [
    { x: 14, y: 24, rot: 0.8 },
    { x: 32, y: 52, rot: -1.4 },
    { x: 8, y: 72, rot: 1.6 },
    { x: 42, y: 38, rot: -0.4 },
  ],
  br: [
    { x: 60, y: 22, rot: -0.6 },
    { x: 80, y: 48, rot: 1.2 },
    { x: 54, y: 70, rot: -1.0 },
    { x: 72, y: 32, rot: 0.4 },
  ],
};

function TasteSpread({ recommendations }: { recommendations: Recommendation[] }) {
  // Group recs by quadrant for stable index-within-quadrant offset.
  const byQuadrant = useMemo(() => {
    const groups: Record<string, Array<{ rec: Recommendation; i: number }>> = {
      tl: [],
      tr: [],
      bl: [],
      br: [],
    };
    recommendations.forEach((r, i) => {
      groups[CATEGORY_META[r.category].quadrant].push({ rec: r, i });
    });
    return groups;
  }, [recommendations]);

  return (
    <div className={styles.taste}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>taste map</span>
        <span className={styles.spreadCount}>{recommendations.length}</span>
      </header>

      <div className={styles.tasteCanvas} aria-hidden="false">
        {/* axis cross */}
        <div className={styles.tasteAxisH} aria-hidden="true" />
        <div className={styles.tasteAxisV} aria-hidden="true" />

        {/* quadrant labels (corners) */}
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

        {/* chips */}
        {(Object.entries(byQuadrant) as Array<
          ["tl" | "tr" | "bl" | "br", Array<{ rec: Recommendation; i: number }>]
        >).map(([quadrant, items]) =>
          items.map(({ rec, i }, indexInQuadrant) => {
            const pool = QUADRANT_OFFSETS[quadrant];
            const offset = pool[indexInQuadrant % pool.length];
            return (
              <div
                key={i}
                className={styles.tasteChip}
                data-category={rec.category}
                style={{
                  left: `${offset.x}%`,
                  top: `${offset.y}%`,
                  ["--rot" as string]: `${offset.rot}deg`,
                }}
              >
                <span className={styles.tasteChipName}>{rec.name}</span>
                {rec.city && (
                  <span className={styles.tasteChipCity}>{rec.city}</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAP — country silhouette + pins                                     */
/* ------------------------------------------------------------------ */

// Logical SVG canvas for the country silhouette. The actual rendered
// size is responsive via CSS — viewBox keeps geometry intact.
const CMAP_W = 1000;
const CMAP_H = 620;

function CountryMapSpread({
  iso,
  pins,
}: {
  iso: string;
  pins: CityPin[];
}) {
  const projection = useMemo(
    () => buildCountryProjection(iso, CMAP_W, CMAP_H),
    [iso]
  );
  const [activePin, setActivePin] = useState(0);

  if (!projection) {
    return (
      <div className={styles.map}>
        <header className={styles.spreadHeader}>
          <span className={styles.spreadKicker}>country</span>
        </header>
        <p className={styles.mapEmpty}>silhouette unavailable.</p>
      </div>
    );
  }

  const projectedPins = pins.map((pin) => ({
    pin,
    xy: projection.project(pin.coords),
  }));

  const active = pins[activePin];
  const activeXY = projectedPins[activePin]?.xy ?? [0, 0];

  return (
    <div className={styles.map}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>country</span>
        <span className={styles.spreadCount}>{pins.length}</span>
      </header>

      <div className={styles.mapCanvas}>
        <svg
          viewBox={`0 0 ${CMAP_W} ${CMAP_H}`}
          className={styles.mapSvg}
          aria-hidden="true"
        >
          <path d={projection.d} className={styles.mapSilhouette} />

          {/* pins */}
          {projectedPins.map(({ pin, xy }, i) => {
            const isActive = i === activePin;
            return (
              <g
                key={pin.name}
                transform={`translate(${xy[0]}, ${xy[1]})`}
                className={`${styles.mapPin} ${isActive ? styles.mapPinActive : ""}`}
                role="button"
                tabIndex={0}
                aria-label={pin.name}
                onClick={() => setActivePin(i)}
                onMouseEnter={() => setActivePin(i)}
                data-cursor="hover"
              >
                {/* hit halo (invisible, big enough to tap on touch) */}
                <circle r={26} className={styles.mapPinHalo} />
                {/* ring + dot */}
                <circle r={isActive ? 9 : 6} className={styles.mapPinRing} />
                <circle r={isActive ? 4 : 2.6} className={styles.mapPinDot} />
                <text
                  className={styles.mapPinLabel}
                  x={12}
                  y={4}
                  // Cities very close to the country's right edge
                  // would otherwise spill outside the SVG — flip the
                  // label to the left of the pin when we're past 80%
                  // width.
                  textAnchor={xy[0] > CMAP_W * 0.78 ? "end" : "start"}
                  transform={
                    xy[0] > CMAP_W * 0.78 ? "translate(-24, 0)" : undefined
                  }
                >
                  {pin.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* active pin detail rail */}
      {active && (
        <div className={styles.mapDetail}>
          {active.photo && (
            <div
              className={styles.mapDetailPhoto}
              style={{ backgroundImage: `url(${active.photo})` }}
              role="img"
              aria-label={active.name}
            />
          )}
          <div className={styles.mapDetailBody}>
            <div className={styles.mapDetailName}>{active.name}</div>
            {active.memory && (
              <p className={styles.mapDetailMemory}>{active.memory}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NOTES — dispatch entries                                           */
/* ------------------------------------------------------------------ */

function NotesSpread({ entries }: { entries: DispatchEntry[] }) {
  return (
    <div className={styles.notes}>
      <header className={styles.spreadHeader}>
        <span className={styles.spreadKicker}>dispatch</span>
        <span className={styles.spreadCount}>{entries.length}</span>
      </header>

      <ol className={styles.notesList}>
        {entries.map((e, i) => (
          <li key={i} className={styles.note}>
            <div className={styles.noteHead}>
              {e.day && <span className={styles.noteDay}>{e.day}</span>}
              {e.place && <span className={styles.notePlace}>{e.place}</span>}
            </div>
            <p className={styles.noteText}>{e.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
