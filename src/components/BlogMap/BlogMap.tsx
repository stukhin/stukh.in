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

// Zoom — wheel makes large jumps now (was 0.0015, took the user
// dozens of scroll units to see anything). Bumped ZOOM_MAX so the
// user can actually zoom in meaningfully when they want to.
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 3.2;
const ZOOM_INITIAL = 1.0;
const ZOOM_STEP = 0.005;
const ZOOM_BUTTON_STEP = 0.22;

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

    return featureCollection.features.map((f: CountryFeature) => ({
      id: String(f.id ?? ""),
      name: f.properties?.name ?? "",
      d: pathGen(f) ?? "",
    }));
  }, []);

  // Parallax + wheel-zoom — entirely imperative so 60fps mouse moves
  // don't trigger React re-renders. CSS variables drive the transform.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    wrap.style.setProperty("--zoom", String(ZOOM_INITIAL));

    const noHover = window.matchMedia("(hover: none)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let raf: number | null = null;
    let pendingMx = 0;
    let pendingMy = 0;

    const flush = () => {
      raf = null;
      wrap.style.setProperty("--mx", String(pendingMx));
      wrap.style.setProperty("--my", String(pendingMy));
    };

    const onMove = (e: MouseEvent) => {
      pendingMx = (e.clientX / window.innerWidth - 0.5) * 2;
      pendingMy = (e.clientY / window.innerHeight - 0.5) * 2;
      if (raf === null) raf = requestAnimationFrame(flush);
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
    }
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("mousemove", onMove);
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
                exact country silhouette. */}
            {visited.map((p) => (
              <clipPath key={`clip-${p.id}`} id={`country-clip-${p.id}`}>
                <path d={p.d} />
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
                /* xmlns is set via dangerouslySetInnerHTML-style
                   spread because React's HTMLDivElement type
                   doesn't list xmlns; without it, browsers default
                   to HTML namespace inside foreignObject which is
                   what we want anyway. */
                {...({
                  xmlns: "http://www.w3.org/1999/xhtml",
                } as Record<string, string>)}
                style={{
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                }}
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
              invisible. */}
          {visited.map((p) => (
            <path
              key={`hit-${p.id}`}
              d={p.d}
              className={styles.visitedHit}
              onMouseEnter={() => onCountryEnter(p.id)}
              onMouseLeave={onCountryLeave}
              onClick={() => onCountryClick(p.id)}
              data-cursor="hover"
            >
              <title>{p.name}</title>
            </path>
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
