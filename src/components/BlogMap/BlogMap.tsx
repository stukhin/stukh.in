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

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * /blog world map. Renders Natural Earth's 110m country dataset
 * (≈ 80 KB TopoJSON, served via the `world-atlas` npm package) as
 * SVG paths through a d3-geo Equal Earth projection.
 *
 * The map is the page's full-bleed background with two interaction
 * layers on top:
 *
 *  - Mouse-driven parallax. A window-level mousemove listener
 *    writes --mx / --my into the wrap each rAF tick; the CSS
 *    transform composes that with the current --zoom into a single
 *    transform on the wrap. A 180ms ease-out smooths jitter into
 *    a trailing weighty motion.
 *
 *  - Wheel + button zoom. Wheel inside the map wraps deltaY into
 *    a --zoom CSS variable, clamped 0.7 → 3.2. Two buttons in the
 *    bottom-left of the page do the same in fixed steps for users
 *    without a wheel (or a less surgical preference).
 *
 * Visited countries (see visits.ts) draw on top of the rest of the
 * world with a contrasting fill, scale up sharply on hover, and
 * surface a cursor-following plate with the dates / cities / a
 * "click to open" hint. Clicking opens the rectangular country
 * modal with the long-form notes.
 *
 * Country borders for the rest of the world are dropped on purpose:
 * the user wanted continents read as one mass, with country outlines
 * only on the visited ones — the visited paths have their own thin
 * stroke that's hidden until hover.
 */
export default function BlogMap() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(ZOOM_INITIAL);
  const [hover, setHover] = useState<CountryHoverState | null>(null);
  const [openIso, setOpenIso] = useState<string | null>(null);

  // Project all 200 country paths once on mount — viewBox is fixed,
  // preserveAspectRatio="meet" keeps every continent in frame at any
  // viewport aspect (Australia included; the previous "slice"
  // setting was clipping the bottom of the map on wide displays).
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

  // Parallax + wheel-zoom effect — entirely imperative so that
  // 60-times-per-second mouse moves don't trigger React re-renders.
  // CSS variables on the wrap drive the transform.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    // Initialize zoom var so first paint matches our default.
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
    // Wheel zoom is wired even on touch devices in case a desktop
    // user has reduced-motion on but still wants to zoom.
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
    const visit = VISIT_BY_ISO.get(iso);
    if (visit) setHover({ visit });
  };
  const onCountryLeave = () => setHover(null);
  const onCountryClick = (iso: string) => {
    if (VISIT_BY_ISO.has(iso)) {
      setOpenIso(iso);
      setHover(null);
    }
  };

  const openVisit = openIso ? VISIT_BY_ISO.get(openIso) ?? null : null;

  // Split visited from the rest so visited paths render LAST and
  // stay on top of their neighbours when they scale up on hover.
  // (SVG has no z-index — render order is the only z-control.)
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
          } as CSSProperties
        }
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.map}
          preserveAspectRatio="xMidYMid meet"
          aria-label="World map of visited places"
        >
          {/* Default world: filled, no stroke, so neighbouring
              countries blur into one continent silhouette. */}
          {unvisited.map((p) => (
            <path
              key={p.id}
              d={p.d}
              className={styles.country}
            >
              <title>{p.name}</title>
            </path>
          ))}

          {/* Visited countries on top so the 2× hover scale doesn't
              get clipped by neighbours. */}
          {visited.map((p) => (
            <path
              key={p.id}
              d={p.d}
              className={`${styles.country} ${styles.visited}`}
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

      {/* Bottom-left zoom controls. Only desktop / mouse-pointer
          users see them — phones have pinch zoom of their own. */}
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

      {/* "Under construction" stamp — centred over the map until
          the page actually has stories to show. */}
      <div className={styles.stamp}>under construction</div>

      <BlogCountryPlate hover={hover} />
      <BlogCountryModal visit={openVisit} onClose={() => setOpenIso(null)} />
    </div>
  );
}
