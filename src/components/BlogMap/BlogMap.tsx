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

// SVG viewBox dimensions used to fit the projection. Equal Earth
// has an intrinsic ratio of ~2.05; we pick 1000 × 488 so fitSize
// produces clean numbers. The viewBox we actually render with is
// recomputed from the projected feature bounds after fitting, so the
// map fills the SVG edge-to-edge with no internal margin.
const FIT_W = 1000;
const FIT_H = 488;

// Zoom. Floor at 1.0 = the map sized to fill the viewport
// vertically with no parallax slack. Default ZOOM_INITIAL is 1.2
// so the page lands on a slightly cropped map and the cursor can
// pan around it from frame zero — same idea as a hover-zoomed
// modal photo. Wheel + buttons can zoom out to 1.0 (full world
// in frame, no parallax) or in to 3.2.
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.2;
const ZOOM_INITIAL = 1.2;
const ZOOM_STEP = 0.005;
const ZOOM_BUTTON_STEP = 0.22;

// Scale factor applied to the visual on hover. Smaller than before
// (2× felt aggressive and made tightly-clustered countries — UK /
// France / Spain / Portugal — hard to navigate, since one
// country's hit area would smother its neighbours). 1.15 still
// reads as "this country popped" while keeping each neighbour
// reachable. The hovered country is also rendered LAST so it
// always paints on top of its siblings.
const HOVER_SCALE = 1.15;

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
  const svgRef = useRef<SVGSVGElement>(null);
  /** d3-geo projection — also kept in a ref so the cursor lat/long
   *  overlay can call projection.invert() at the same coords used
   *  by the path generator. */
  const projectionRef = useRef<ReturnType<typeof geoEqualEarth> | null>(null);
  const coordsRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(ZOOM_INITIAL);
  /** Latest cursor position relative to the viewport, [0..1] on
   *  each axis. Pan is recomputed from this on every rAF / zoom
   *  change rather than tracking pan as its own piece of state. */
  const cursorRef = useRef({ mx: 0.5, my: 0.5 });
  /** Reference to the latest closure that recomputes pan from
   *  cursor + zoom. Set by the cursor/wheel effect; called by
   *  the +/- zoom buttons so they can reapply pan after a zoom
   *  change without duplicating the math. */
  const recomputePanRef = useRef<(() => void) | null>(null);
  const leaveTimerRef = useRef<number | null>(null);
  const [hover, setHover] = useState<CountryHoverState | null>(null);
  const [openIso, setOpenIso] = useState<string | null>(null);

  // Project all country paths once on mount. The viewBox is then
  // tightened to the projected feature bounds — no internal padding,
  // so the northernmost / southernmost lands actually touch the SVG
  // top + bottom edges. Combined with CSS height: 100% on the SVG,
  // this is what lets Antarctica's coastline sit flush with the
  // viewport bottom.
  const { paths, viewBoxStr, mapAspect, vb } = useMemo(() => {
    const topology = worldRaw as unknown as Topology;
    const featureCollection = feature(
      topology,
      topology.objects.countries as GeometryCollection
    ) as FeatureCollection<Geometry, { name?: string }>;

    const projection = geoEqualEarth().fitSize(
      [FIT_W, FIT_H],
      featureCollection
    );
    projectionRef.current = projection;
    const pathGen = geoPath(projection);

    // True bounds of the projected world — fitSize gives us the
    // requested rect, but rounded edges of Equal Earth at extreme
    // latitudes leave a sliver of unused space inside that rect, so
    // we crop the viewBox down to the actual feature footprint.
    const wb = pathGen.bounds(featureCollection);
    const vbX = wb[0][0];
    const vbY = wb[0][1];
    const vbW = wb[1][0] - wb[0][0];
    const vbH = wb[1][1] - wb[0][1];

    const list = featureCollection.features.map((f: CountryFeature) => {
      const d = pathGen(f) ?? "";
      // Bbox centre per country (in projected SVG coords). Used as
      // the transform origin when the visited <clipPath> pre-scales
      // to match the visual's hover scale.
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

    return {
      paths: list,
      viewBoxStr: `${vbX} ${vbY} ${vbW} ${vbH}`,
      mapAspect: vbW / vbH,
      vb: { x: vbX, y: vbY, w: vbW, h: vbH },
    };
  }, []);

  // Wheel-zoom + drag-to-pan, imperative so high-frequency events
  // don't trigger React re-renders. Pan is clamped so the map's
  // bounding box always covers the viewport — at the baseline zoom
  // (1.0) the map already fills vertically and only the horizontal
  // overflow is pannable; zooming in opens up vertical pan room as
  // well. Parallax was dropped on /blog because it conflicted with
  // the strict "Antarctica touches the bottom edge" requirement.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    wrap.style.setProperty("--zoom", String(ZOOM_INITIAL));
    wrap.style.setProperty("--pan-x", "0px");
    wrap.style.setProperty("--pan-y", "0px");

    /**
     * Recompute pan from cursor position + current zoom. The map's
     * baseline height = wrap height (CSS height: 100% on the SVG);
     * width = height × mapAspect. Multiplying both by zoom gives
     * the visible map dims, and the half of (visible − viewport)
     * is the maximum slack on each axis.
     *
     *   pan_x = (1 − 2·cx) · maxPan_X
     *
     * cx = 0   → pan_x = +maxPan_X (map shifted right → see LEFT)
     * cx = 1   → pan_x = −maxPan_X (map shifted left  → see RIGHT)
     * cx = 0.5 → pan_x = 0          (map centred)
     *
     * At zoom 1 there's no slack on either axis (baseline = wrap),
     * so cursor movement leaves the map perfectly centred.
     */
    const recomputePan = () => {
      const wrapH = wrap.clientHeight;
      const wrapW = wrap.clientWidth;
      const baselineH = wrapH;
      const baselineW = baselineH * mapAspect;
      const z = zoomRef.current;
      const maxPanX = Math.max(0, (baselineW * z - wrapW) / 2);
      const maxPanY = Math.max(0, (baselineH * z - wrapH) / 2);
      const panX = (1 - 2 * cursorRef.current.mx) * maxPanX;
      const panY = (1 - 2 * cursorRef.current.my) * maxPanY;
      wrap.style.setProperty("--pan-x", `${panX}px`);
      wrap.style.setProperty("--pan-y", `${panY}px`);
    };
    recomputePanRef.current = recomputePan;

    let raf: number | null = null;
    const flush = () => {
      raf = null;
      recomputePan();
    };

    const onMove = (e: MouseEvent) => {
      cursorRef.current.mx = Math.max(
        0,
        Math.min(1, e.clientX / window.innerWidth)
      );
      cursorRef.current.my = Math.max(
        0,
        Math.min(1, e.clientY / window.innerHeight)
      );
      if (raf === null) raf = requestAnimationFrame(flush);
    };

    const onWheel = (e: WheelEvent) => {
      if (!wrap.contains(e.target as Node)) return;
      const next = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomRef.current - e.deltaY * ZOOM_STEP)
      );
      // At a zoom limit and wheeling further in the same direction
      // — no zoom change to make. Let the event through so the
      // global page-wheel handler can decide what to do with it.
      // (Combined with its gesture gate, the user has to pause and
      // start a new wheel gesture before it fires a page nav.)
      if (next === zoomRef.current) return;
      e.preventDefault();
      zoomRef.current = next;
      wrap.style.setProperty("--zoom", String(zoomRef.current));
      recomputePan();
    };

    const onResize = () => recomputePan();

    // Initial pan computed from default cursor (centred) + initial
    // zoom — gets the pan vars set before first paint.
    recomputePan();

    window.addEventListener("mousemove", onMove);
    window.addEventListener("resize", onResize);
    wrap.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      wrap.removeEventListener("wheel", onWheel);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [mapAspect]);

  /**
   * Lat / long overlay. Window mousemove + the SVG's screen CTM
   * give us the cursor's position in SVG user coords; the d3
   * projection's invert maps back to (longitude, latitude). The
   * result lives in a small fixed-position div anchored just below
   * + right of the cursor.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(hover: none)").matches) return;

    const fmt = (val: number, posLetter: string, negLetter: string) => {
      const dir = val >= 0 ? posLetter : negLetter;
      const abs = Math.abs(val);
      const deg = Math.floor(abs);
      const min = Math.floor((abs - deg) * 60);
      return `${deg}°${min.toString().padStart(2, "0")}′${dir}`;
    };

    let raf: number | null = null;
    let pendingX = 0;
    let pendingY = 0;
    const flush = () => {
      raf = null;
      const svg = svgRef.current;
      const projection = projectionRef.current;
      const display = coordsRef.current;
      if (!svg || !projection || !display) return;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const inv = ctm.inverse();
      const pt = svg.createSVGPoint();
      pt.x = pendingX;
      pt.y = pendingY;
      const local = pt.matrixTransform(inv);
      const lonLat = projection.invert?.([local.x, local.y]);
      if (!lonLat || !Number.isFinite(lonLat[0]) || !Number.isFinite(lonLat[1])) {
        // Cursor is over the cream background outside the
        // projected world (Equal Earth's curved edges).
        display.style.opacity = "0";
        return;
      }
      const [lon, lat] = lonLat;
      display.textContent = `${fmt(lat, "N", "S")}    ${fmt(lon, "E", "W")}`;
      display.style.opacity = "1";
      display.style.transform = `translate3d(${pendingX + 18}px, ${
        pendingY + 22
      }px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (raf === null) raf = requestAnimationFrame(flush);
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
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
    // Reapply cursor-driven pan to the new zoom level (the slack
    // grows / shrinks as zoom changes).
    recomputePanRef.current?.();
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
  /**
   * Render order with the hovered country pushed to the end of the
   * array. SVG has no z-index — paint order = render order — so a
   * hovered country needs to be the LAST visited path drawn,
   * otherwise its 1.15× scale-up sits behind a neighbour painted
   * after it. The list keeps the original order otherwise so all
   * non-hovered countries paint in a stable sequence.
   */
  const visitedSorted = hover
    ? [
        ...visited.filter((p) => p.id !== hover.visit.iso),
        ...visited.filter((p) => p.id === hover.visit.iso),
      ]
    : visited;

  /**
   * Visits whose country is too small to be in the 110m TopoJSON
   * (Seychelles, etc.) — they have explicit coords on the visit
   * record and we render them as a small filled circle at the
   * projected location. Same hover plate / click-to-modal as a
   * full country path.
   */
  const visitedCountryISOs = new Set(visited.map((p) => p.id));
  const dotMarkers = useMemo(() => {
    const projection = projectionRef.current;
    if (!projection) return [];
    const visits = Array.from(VISIT_BY_ISO.values());
    return visits
      .filter((v) => v.coords && !visitedCountryISOs.has(v.iso))
      .map((v) => {
        const projected = projection(v.coords as [number, number]);
        if (!projected) return null;
        return {
          iso: v.iso,
          name: v.name,
          x: projected[0],
          y: projected[1],
        };
      })
      .filter((m): m is { iso: string; name: string; x: number; y: number } =>
        m !== null
      );
    // visitedCountryISOs is rebuilt every render but its contents
    // are deterministic from VISIT_BY_ISO, so we only depend on
    // the underlying source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  return (
    <div className={styles.root}>
      <div
        ref={wrapRef}
        className={styles.mapWrap}
        style={
          {
            "--hover-scale": String(HOVER_SCALE),
            "--map-aspect": String(mapAspect),
          } as CSSProperties
        }
      >
        <svg
          ref={svgRef}
          viewBox={viewBoxStr}
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
          {visitedSorted.map((p) => {
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

          {/* Dot markers for visits whose country isn't in the
              110m TopoJSON (Seychelles + future small-island
              entries). Same fill/scale-on-hover treatment as a
              full country — just rendered as a small filled
              circle at the projected lat/long. */}
          {dotMarkers.map((m) => {
            const isActive = hover?.visit.iso === m.iso;
            return (
              <circle
                key={`dot-visual-${m.iso}`}
                cx={m.x}
                cy={m.y}
                r={2.6}
                className={`${styles.visitedDot} ${
                  isActive ? styles.visitedDotActive : ""
                }`}
              />
            );
          })}

          {/* LiquidEther layer — single instance for the currently
              hovered country, clipped to its silhouette. Mounted on
              hover, unmounted on leave so we don't keep WebGL
              running idle when nothing is highlighted. */}
          {hover && (
            /* Wrap the foreignObject in a <g> that carries the clip.
               Applying clip-path directly on a <foreignObject> with
               a WebGL canvas inside is unreliable across browsers —
               in some Chromium / WebKit builds the canvas paints
               unclipped or the clip is offset. Clipping on the
               parent <g> is the documented workaround: the foreign
               content is rendered first, then the whole group is
               clipped as a single shape. */
            <g
              key="liquid"
              clipPath={`url(#country-clip-${hover.visit.iso})`}
            >
              <foreignObject
                x={vb.x}
                y={vb.y}
                width={vb.w}
                height={vb.h}
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
            </g>
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

          {/* Hit areas for the dot markers — bigger transparent
              circle around the visible 2.6r dot so the cursor can
              actually land on it (the visual is too small to grab
              by itself). */}
          {dotMarkers.map((m) => (
            <circle
              key={`dot-hit-${m.iso}`}
              cx={m.x}
              cy={m.y}
              r={14}
              className={styles.visitedDotHit}
              onMouseEnter={() => onCountryEnter(m.iso)}
              onMouseLeave={onCountryLeave}
              onClick={() => onCountryClick(m.iso)}
              data-cursor="magnifier"
              aria-label={m.name}
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

      {/* Lat/long readout that follows the cursor over the map.
          Position + content are written imperatively (no React
          re-render per mousemove) — see the cursor effect below
          for the writer. The element is always mounted but parked
          off-screen until the first move. */}
      <div ref={coordsRef} className={styles.coords} aria-hidden="true" />

      <BlogCountryPlate hover={hover} />
      <BlogCountryModal visit={openVisit} onClose={() => setOpenIso(null)} />
    </div>
  );
}
