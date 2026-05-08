"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import worldRaw from "world-atlas/countries-110m.json";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import LiquidEther from "../LiquidEther/LiquidEther";
import BlogCountryPlate, {
  type CountryHoverState,
} from "./BlogCountryPlate";
import BlogCountryModal from "./BlogCountryModal";
import { VISIT_BY_ISO } from "./visits";
import styles from "./BlogMap.module.css";

// SVG viewBox dimensions. Equal Earth's intrinsic aspect ratio is
// roughly 2.05 : 1 — picking 1000 × 488 keeps the math clean and
// the projection fills its viewBox edge-to-edge after fitExtent.
const WIDTH = 1000;
const HEIGHT = 488;

// Parallax: cursor at viewport edge translates the map this many
// pixels in the opposite direction (negative correlation gives the
// classic "background is deeper than I am" feel).
const PARALLAX_PX = 24;

// Zoom. Baseline (1.0) = the map sized to fill the viewport
// vertically (top of map → top of viewport, bottom → bottom).
// Zooming out below baseline isn't allowed — that's why the floor
// is 1.0; zooming in is the only direction the user can move.
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.2;
const ZOOM_INITIAL = 1.0;
const ZOOM_STEP = 0.005;
const ZOOM_BUTTON_STEP = 0.22;

/** Click-vs-drag threshold (px). The user has to move the mouse
 *  this far during a mousedown for the action to count as a pan
 *  rather than a click on whatever was under the cursor. Stops
 *  drags from accidentally opening the country modal. */
const DRAG_THRESHOLD_PX = 5;

// Scale factor applied to the visual on hover. Same factor is baked
// into the hit-area path's permanent scale so the hover region is
// always the size of the would-be enlarged country — no flicker
// when the cursor sits near an edge during the scale animation.
const HOVER_SCALE = 2;

// How long after a mouseleave we wait before clearing the hover
// state. Smooths cursor-near-edge wobble that would otherwise rapid-
// fire enter/leave events as the user feathers the boundary.
const LEAVE_DEBOUNCE_MS = 80;

// LiquidEther palette — warm tones that pair with the page's cream
// background and the visited country's accent fill.
const LIQUID_COLORS = ["#c14a3a", "#f08a5d", "#ffd2b3"];

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * /blog world map. Renders Natural Earth's 110m country dataset
 * (~80 KB TopoJSON, served via the `world-atlas` npm package) as
 * SVG paths through a d3-geo Equal Earth projection.
 *
 * The map fills the page as a parallax background. Country borders
 * are dropped on the rest-of-world so each continent reads as one
 * mass. Visited countries (see visits.ts) get a contrasting fill
 * and, on hover, scale 2× and reveal a fluid-dynamics LiquidEther
 * animation clipped to their exact silhouette through an SVG
 * <clipPath>.
 *
 * Hover state is JS-driven (not CSS :hover) and the path that
 * receives mouse events is permanently sized to the 2× hover bounds —
 * this is how we avoid the classic "transition shrinks the hit area
 * out from under the cursor → stop hover → expand again" flicker.
 * A short leave-debounce smooths cursor-feathering at the edge.
 */
export default function BlogMap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(ZOOM_INITIAL);
  const panRef = useRef({ x: 0, y: 0 });
  /** True when a drag pushed past DRAG_THRESHOLD. Read by the
   *  click handler so dragging doesn't accidentally open the
   *  country modal at mouseup. */
  const dragMovedRef = useRef(false);
  const leaveTimerRef = useRef<number | null>(null);
  const [hover, setHover] = useState<CountryHoverState | null>(null);
  const [openIso, setOpenIso] = useState<string | null>(null);

  // Project all country paths once on mount. viewBox is fixed,
  // preserveAspectRatio="meet" keeps every continent in frame at any
  // viewport aspect (Australia included).
  const paths = useMemo(() => {
    const topology = worldRaw as unknown as Topology;
    const featureCollection = feature(
      topology,
      topology.objects.countries as GeometryCollection
    ) as FeatureCollection<Geometry, { name?: string }>;

    const projection = geoEqualEarth().fitExtent(
      [
        [10, 10],
        [WIDTH - 10, HEIGHT - 10],
      ],
      featureCollection
    );
    const pathGen = geoPath(projection);

    return featureCollection.features.map((f: CountryFeature) => {
      const d = pathGen(f) ?? "";
      // Bbox centre in projected SVG coords. Used as the transform
      // origin when we pre-scale the country's <clipPath> to match
      // the visual's hover scale, so the liquid renders inside the
      // enlarged silhouette rather than the original-size one.
      const bounds = pathGen.bounds(f);
      const cx = (bounds[0][0] + bounds[1][0]) / 2;
      const cy = (bounds[0][1] + bounds[1][1]) / 2;
      return {
        id: String(f.id ?? ""),
        name: f.properties?.name ?? "",
        d,
        cx,
        cy,
      };
    });
  }, []);

  // Parallax + wheel-zoom + drag-to-pan — entirely imperative so
  // high-frequency events don't trigger React re-renders. CSS
  // variables drive a single transform on the wrap.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    wrap.style.setProperty("--zoom", String(ZOOM_INITIAL));
    wrap.style.setProperty("--pan-x", "0px");
    wrap.style.setProperty("--pan-y", "0px");

    const noHover = window.matchMedia("(hover: none)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf: number | null = null;
    let pendingMx = 0;
    let pendingMy = 0;
    /** Active drag, if any. Holds the cursor + pan values at
     *  mousedown so onMouseMove can compute the delta. */
    let drag: {
      startX: number;
      startY: number;
      startPanX: number;
      startPanY: number;
    } | null = null;

    const flushParallax = () => {
      raf = null;
      wrap.style.setProperty("--mx", String(pendingMx));
      wrap.style.setProperty("--my", String(pendingMy));
    };

    const onMove = (e: MouseEvent) => {
      if (drag) {
        // Active drag — pan the map by the cursor delta. Parallax
        // is also held at zero so the two don't compound.
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (
          !dragMovedRef.current &&
          (Math.abs(dx) > DRAG_THRESHOLD_PX ||
            Math.abs(dy) > DRAG_THRESHOLD_PX)
        ) {
          dragMovedRef.current = true;
          // Once we cross the threshold, snap parallax to zero so
          // the drag motion is read 1:1 from the cursor.
          wrap.style.setProperty("--mx", "0");
          wrap.style.setProperty("--my", "0");
        }
        if (dragMovedRef.current) {
          panRef.current.x = drag.startPanX + dx;
          panRef.current.y = drag.startPanY + dy;
          wrap.style.setProperty(
            "--pan-x",
            `${panRef.current.x}px`
          );
          wrap.style.setProperty(
            "--pan-y",
            `${panRef.current.y}px`
          );
        }
        return;
      }
      pendingMx = (e.clientX / window.innerWidth - 0.5) * 2;
      pendingMy = (e.clientY / window.innerHeight - 0.5) * 2;
      if (raf === null) raf = requestAnimationFrame(flushParallax);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      // Don't intercept clicks on the zoom buttons or the modal
      // backdrop, which live outside the wrap; only start a drag
      // for events inside the map area.
      if (!wrap.contains(e.target as Node)) return;
      drag = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
      };
      dragMovedRef.current = false;
      // Disable the smoothing transition for the duration of the
      // drag so the pan tracks the cursor 1:1 instead of lagging.
      wrap.classList.add(styles.mapWrapDragging);
    };

    const onMouseUp = () => {
      if (drag && dragMovedRef.current) {
        // Suppress the trailing click event that fires on mouseup
        // — otherwise dragging across a country would also open
        // its modal. The flag is read by the country click
        // handler and resets on the next interaction.
      } else {
        // Click without drag — clear the flag so subsequent clicks
        // open the modal as usual.
        dragMovedRef.current = false;
      }
      drag = null;
      wrap.classList.remove(styles.mapWrapDragging);
    };

    const onWheel = (e: WheelEvent) => {
      if (!wrap.contains(e.target as Node)) return;
      e.preventDefault();
      zoomRef.current = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomRef.current - e.deltaY * ZOOM_STEP)
      );
      wrap.style.setProperty("--zoom", String(zoomRef.current));
    };

    if (!noHover && !reducedMotion) {
      window.addEventListener("mousemove", onMove);
    } else {
      // Even without parallax, drag should still work on tablets
      // / reduced-motion machines.
      window.addEventListener("mousemove", onMove);
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      wrap.removeEventListener("wheel", onWheel);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  const adjustZoom = (delta: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    zoomRef.current = Math.max(
      ZOOM_MIN,
      Math.min(ZOOM_MAX, zoomRef.current + delta)
    );
    wrap.style.setProperty("--zoom", String(zoomRef.current));
  };

  const onCountryEnter = (iso: string) => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    const visit = VISIT_BY_ISO.get(iso);
    if (visit) setHover({ visit });
  };
  const onCountryLeave = () => {
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
    }
    leaveTimerRef.current = window.setTimeout(() => {
      leaveTimerRef.current = null;
      setHover(null);
    }, LEAVE_DEBOUNCE_MS);
  };
  const onCountryClick = (iso: string) => {
    if (dragMovedRef.current) {
      // The user just finished a drag across this country — don't
      // treat the click as "open the country modal".
      dragMovedRef.current = false;
      return;
    }
    if (VISIT_BY_ISO.has(iso)) {
      setOpenIso(iso);
      setHover(null);
    }
  };

  const openVisit = openIso ? VISIT_BY_ISO.get(openIso) ?? null : null;

  // Split visited from the rest so visited paths render LAST and
  // stay on top of their neighbours when they scale up on hover.
  const unvisited = paths.filter((p) => !VISIT_BY_ISO.has(p.id));
  const visited = paths.filter((p) => VISIT_BY_ISO.has(p.id));

  return (
    <div className={styles.root}>
      <div
        ref={wrapRef}
        className={styles.mapWrap}
        style={
          {
            "--parallax": `${PARALLAX_PX}px`,
            "--hover-scale": String(HOVER_SCALE),
          } as CSSProperties
        }
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.map}
          preserveAspectRatio="xMidYMid meet"
          aria-label="World map of visited places"
        >
          <defs>
            {/* One <clipPath> per visited country — used by the
                LiquidEther <foreignObject> to mask its canvas to the
                exact country silhouette. The path inside is
                pre-scaled HOVER_SCALE× around the country's bbox
                centre so the clip lines up with the visual's
                hover-scale state (not the original-size country). */}
            {visited.map((p) => (
              <clipPath key={`clip-${p.id}`} id={`country-clip-${p.id}`}>
                <path
                  d={p.d}
                  transform={`translate(${p.cx} ${p.cy}) scale(${HOVER_SCALE}) translate(${-p.cx} ${-p.cy})`}
                />
              </clipPath>
            ))}
          </defs>

          {/* Default world: filled, no stroke, neighbours blur into
              one continent silhouette. */}
          {unvisited.map((p) => (
            <path key={p.id} d={p.d} className={styles.country}>
              <title>{p.name}</title>
            </path>
          ))}

          {/* Visited countries: visual layer underneath (scales on
              hover, no pointer events), then the LiquidEther overlay
              for the currently-hovered one (clipped to its path),
              then the hit-area path on top. The hit area is
              permanently scaled to HOVER_SCALE so the cursor zone
              never moves out from under the cursor mid-animation —
              that was the source of the country flicker. */}
          {visited.map((p) => {
            const isActive = hover?.visit.iso === p.id;
            return (
              <path
                key={`visual-${p.id}`}
                d={p.d}
                className={`${styles.visitedVisual} ${
                  isActive ? styles.visitedVisualActive : ""
                }`}
              />
            );
          })}

          {/* LiquidEther layer — single instance for the currently
              hovered country, clipped to its silhouette. Mounted on
              hover, unmounted on leave so we don't keep WebGL
              running idle when nothing is highlighted. */}
          {hover && (
            <foreignObject
              key="liquid"
              x="0"
              y="0"
              width={WIDTH}
              height={HEIGHT}
              clipPath={`url(#country-clip-${hover.visit.iso})`}
              style={{ pointerEvents: "none" }}
            >
              <div
                /* xmlns set via spread because React's
                   HTMLDivElement type doesn't list it; browsers
                   default to HTML namespace inside foreignObject
                   regardless. */
                {...({
                  xmlns: "http://www.w3.org/1999/xhtml",
                } as Record<string, string>)}
                className={styles.liquidWrap}
              >
                <LiquidEther
                  colors={LIQUID_COLORS}
                  autoDemo
                  autoSpeed={0.7}
                  autoIntensity={2.4}
                  cursorSize={70}
                  mouseForce={28}
                  resolution={0.4}
                  iterationsPoisson={16}
                  iterationsViscous={16}
                  takeoverDuration={0.2}
                  autoResumeDelay={1500}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </foreignObject>
          )}

          {/* Permanent 2× hit area on top — captures all mouse
              events for the country. Transparent fill so it stays
              invisible. aria-label (not <title>) gives the country
              a name for screen readers without firing the native
              browser tooltip we don't want — the cursor-following
              plate already carries the visible label. */}
          {visited.map((p) => (
            <path
              key={`hit-${p.id}`}
              d={p.d}
              className={styles.visitedHit}
              onMouseEnter={() => onCountryEnter(p.id)}
              onMouseLeave={onCountryLeave}
              onClick={() => onCountryClick(p.id)}
              data-cursor="magnifier"
              aria-label={p.name}
            />
          ))}
        </svg>
      </div>

      <div className={styles.zoomControls} aria-hidden="true">
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => adjustZoom(ZOOM_BUTTON_STEP)}
          aria-label="Zoom in"
          data-cursor="hover"
        >
          +
        </button>
        <button
          type="button"
          className={styles.zoomBtn}
          onClick={() => adjustZoom(-ZOOM_BUTTON_STEP)}
          aria-label="Zoom out"
          data-cursor="hover"
        >
          −
        </button>
      </div>

      <div className={styles.stamp}>under construction</div>

      <BlogCountryPlate hover={hover} />
      <BlogCountryModal visit={openVisit} onClose={() => setOpenIso(null)} />
    </div>
  );
}
