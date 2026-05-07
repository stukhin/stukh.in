"use client";

import { useEffect, useMemo, useRef } from "react";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import worldRaw from "world-atlas/countries-110m.json";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import styles from "./BlogMap.module.css";

/**
 * ISO 3166-1 numeric codes (matching the `id` field in
 * world-atlas/countries-110m.json) for the countries we want
 * highlighted on the map. Three sample picks for the v0 visual
 * review — once the look is locked we'll wire the full visited
 * list off /walls + a small "places I've been" extras file.
 */
const VISITED = new Set([
  "724", // Spain
  "410", // Korea, Republic of
  "152", // Chile
]);

// SVG viewBox dimensions. Equal Earth's intrinsic aspect ratio is
// roughly 2.05 : 1 — picking 1000 × 488 keeps the math clean and
// the map fills its viewBox edge-to-edge.
const WIDTH = 1000;
const HEIGHT = 488;

// Parallax tuning. Cursor at viewport edge translates the map this
// many pixels in the opposite direction (negative correlation gives
// the classic "background is deeper than I am" feel). Zoom is
// clamped so the user can dial it in a touch without losing the
// world map context.
const PARALLAX_PX = 24;
const ZOOM_MIN = 0.85;
const ZOOM_MAX = 1.6;
const ZOOM_INITIAL = 1.08;
const ZOOM_STEP = 0.0015;

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * /blog world map. Renders Natural Earth's 110m country dataset
 * (~80 KB TopoJSON, served via the `world-atlas` npm package) as
 * SVG paths through a d3-geo Equal Earth projection.
 *
 * Visual model: the map sits as a full-bleed background under the
 * page title. Two interactions give it a sense of "depth":
 *   - Mouse-driven parallax. The map translates a few pixels
 *     opposite to the cursor's offset from the viewport centre,
 *     so moving the cursor right shifts the map left. CSS
 *     transition on the transform smooths the high-frequency
 *     mousemove updates into a trailing weighty motion.
 *   - Wheel zoom. The user can dial scale in / out within tight
 *     bounds. The /blog page is height: 100dvh; overflow: hidden,
 *     so capturing the wheel here doesn't fight any underlying
 *     scroll behaviour.
 *
 * Visited countries paint solid dark against an almost-invisible
 * cream-on-cream fill for the rest of the world; hover deepens
 * to the warm accent. A native <title> on each path gives the
 * country name as a default browser tooltip — proper positioned
 * preview cards land later.
 *
 * Touch / no-hover devices skip the parallax + zoom listeners
 * entirely; the map renders statically there at its initial
 * zoom.
 */
export default function BlogMap() {
  const wrapRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    // Touch devices have no cursor to drive the parallax — render
    // statically there. Reduced-motion users also opt out.
    const noHover = window.matchMedia("(hover: none)").matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (noHover || reducedMotion) {
      wrap.style.setProperty("--zoom", String(ZOOM_INITIAL));
      return;
    }

    let raf: number | null = null;
    let pendingMx = 0;
    let pendingMy = 0;
    let zoom = ZOOM_INITIAL;
    wrap.style.setProperty("--zoom", String(zoom));

    const flush = () => {
      raf = null;
      wrap.style.setProperty("--mx", String(pendingMx));
      wrap.style.setProperty("--my", String(pendingMy));
      wrap.style.setProperty("--zoom", String(zoom));
    };
    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(flush);
    };

    const onMove = (e: MouseEvent) => {
      // Map cursor to a [-1, 1] offset from the viewport centre.
      pendingMx = (e.clientX / window.innerWidth - 0.5) * 2;
      pendingMy = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    };

    const onWheel = (e: WheelEvent) => {
      // Only intercept wheel inside the map wrapper so the rest of
      // the page can still scroll normally on the unlikely day we
      // add scroll content here.
      if (!wrap.contains(e.target as Node)) return;
      e.preventDefault();
      zoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoom - e.deltaY * ZOOM_STEP)
      );
      schedule();
    };

    window.addEventListener("mousemove", onMove);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("wheel", onWheel);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className={styles.root}>
      <div
        className={styles.mapWrap}
        ref={wrapRef}
        style={
          {
            // Custom property the CSS transform reads. Inline default
            // matches ZOOM_INITIAL above so SSR and pre-effect first
            // paint already show the correct scale.
            "--zoom": ZOOM_INITIAL,
            "--parallax": `${PARALLAX_PX}px`,
          } as React.CSSProperties
        }
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={styles.map}
          preserveAspectRatio="xMidYMid slice"
          aria-label="World map of visited places"
        >
          {paths.map((p) => {
            const isVisited = VISITED.has(p.id);
            return (
              <path
                key={p.id}
                d={p.d}
                className={`${styles.country} ${
                  isVisited ? styles.visited : ""
                }`}
              >
                <title>{p.name}</title>
              </path>
            );
          })}
        </svg>
      </div>

      <div className={styles.stamp}>under construction</div>
    </div>
  );
}
