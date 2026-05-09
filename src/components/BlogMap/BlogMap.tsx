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

// How long after a mouseleave we wait before clearing the hover
// state. Smooths cursor-near-edge wobble that would otherwise rapid-
// fire enter/leave events as the user feathers the boundary.
const LEAVE_DEBOUNCE_MS = 80;

// LiquidEther palette — warm tones that pair with the page's cream
// background and the visited country's accent fill.
const LIQUID_COLORS = ["#c14a3a", "#f08a5d", "#ffd2b3"];

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * Per-path explode vector. Same input → same output, so each
 * country always flies the same way every time the user enters
 * focus mode (deterministic feels intentional; truly random feels
 * jittery). Distance is in viewport pixels — large enough to clear
 * the screen even if the country starts at the far edge.
 */
function explodeStyleFor(id: string | number): CSSProperties {
  let seed = 0;
  if (typeof id === "string") {
    for (let i = 0; i < id.length; i++) seed = seed * 31 + id.charCodeAt(i);
  } else {
    seed = id;
  }
  // Hash through a few rounds so neighbouring IDs (which are
  // adjacent country numbers in the topology) don't fly in similar
  // directions.
  seed = Math.abs((seed * 2654435761) >>> 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const distance = 900 + ((seed >> 8) % 700);
  const rotation = (((seed >> 16) % 720) - 360) * 0.6;
  return {
    "--explode-x": `${Math.cos(angle) * distance}px`,
    "--explode-y": `${Math.sin(angle) * distance}px`,
    "--explode-rot": `${rotation}deg`,
  } as CSSProperties;
}

/**
 * Stroke-trace overlay for a single visited country. Reads the path's
 * real length via getTotalLength() and animates stroke-dashoffset
 * from full → 0 over 1.5 s via rAF, writing the value directly to
 * the DOM each frame. CSS transitions on stroke-dashoffset have
 * been flaky here — on countries with multi-subpath geometry
 * (mainland + islands, fragmented borders) the transition often
 * ended visibly short of the perimeter — so we drive the property
 * imperatively to guarantee a clean 100 % final state. Opacity
 * fade-in/out still rides the CSS transition on the .active class.
 */
const STROKE_TRACE_MS = 1500;

function CountryStroke({ d, active }: { d: string; active: boolean }) {
  const ref = useRef<SVGPathElement>(null);
  const lengthRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Final dashoffset overshoots zero so the dash actually wraps
  // PAST the path's start point — guarantees the close-point is
  // painted on multi-subpath countries where the dash sometimes
  // ended a few units short. With a 1 px stroke the overshoot is
  // invisible (it shifts the dash, not the visible stroke endpoint
  // since the dash already covers >= the full path length).
  const FINAL_OVERSHOOT = 12;

  useEffect(() => {
    if (!ref.current) return;
    let L = 0;
    try {
      L = ref.current.getTotalLength();
    } catch {
      L = 2000;
    }
    if (!Number.isFinite(L) || L <= 0) L = 2000;
    // Generous padding so subpath rounding can't leave a seam.
    const dashLen = L + 24;
    lengthRef.current = dashLen;
    ref.current.style.strokeDasharray = `${dashLen} ${dashLen}`;
    ref.current.style.strokeDashoffset = active
      ? String(-FINAL_OVERSHOOT)
      : String(dashLen);
    // active dependency intentionally omitted — only re-measure
    // when the path geometry changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  useEffect(() => {
    const path = ref.current;
    if (!path) return;
    const dashLen = lengthRef.current;
    if (dashLen <= 0) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!active) {
      // Reset to invisible. Opacity fade (CSS) handles the visible
      // departure; the next entrance starts from "nothing drawn".
      path.style.strokeDashoffset = String(dashLen);
      return;
    }

    const start = performance.now();
    const startOffset = dashLen;
    const endOffset = -FINAL_OVERSHOOT;
    path.style.strokeDashoffset = String(startOffset);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / STROKE_TRACE_MS);
      const offset = startOffset + (endOffset - startOffset) * t;
      path.style.strokeDashoffset = String(offset);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        // Force the exact terminal value so float drift can't leave
        // a residual gap at the end of the trace.
        path.style.strokeDashoffset = String(endOffset);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active]);

  return (
    <path
      ref={ref}
      d={d}
      className={`${styles.visitedStroke} ${
        active ? styles.visitedStrokeActive : ""
      }`}
    />
  );
}

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
  // Mirror of `hover` for the imperatively-updated coords readout.
  // The coords flush() runs in a useEffect closure and can't read
  // React state directly without re-creating the listener every
  // render; a ref lets it cheaply check "is the cursor over a
  // country right now?" each frame and hide the lat/long label
  // when it is, since the country plate already carries the
  // location info and the two were stacking on top of each other.
  const hoverRef = useRef<CountryHoverState | null>(null);
  useEffect(() => {
    hoverRef.current = hover;
    // Hide the coords readout the moment a country is hovered, even
    // if the cursor isn't moving — flush() only runs on mousemove,
    // so without this the coords would linger until the next event.
    if (hover && coordsRef.current) {
      coordsRef.current.style.opacity = "0";
    }
  }, [hover]);
  /**
   * Focus mode: when a country is selected, the rest of the map's
   * paths "explode" outward + fade out, the map translates so the
   * selected country sits in the LEFT part of the viewport, and a
   * detail panel slides in from the right. Tracked by ISO so the
   * selected path can opt out of the explode CSS rule below.
   */
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  /**
   * Refs to each visited country's hit path. Used to measure the
   * path's screen position right before entering focus mode so we
   * can translate the map to centre the country on the left third
   * of the viewport. Hit paths are 1:1 with the visible silhouette
   * now (we removed the pre-scale), so getBoundingClientRect on
   * them gives the exact rect we want.
   */
  const visitedPathRefs = useRef<Record<string, SVGPathElement | null>>({});

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
      // Hide the lat/long readout while the cursor is over a
      // visited country — the BlogCountryPlate next to the
      // cursor already carries the location info, and the two
      // labels were overlapping into an unreadable mess.
      if (hoverRef.current) {
        display.style.opacity = "0";
        return;
      }
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
  /**
   * Enter focus mode for the clicked visited country. Computes the
   * delta between the path's current centre and the target focus
   * point (~17 % from the left, vertically centred), then writes
   * the result to --focus-x / --focus-y on .mapWrap. The CSS rule
   * for .mapWrap.focused uses those vars in place of the cursor-
   * driven --pan-x / --pan-y so the map glides to its focused
   * position over the same 1.5 s the explode animation runs for.
   */
  const onCountryClick = (iso: string) => {
    if (!VISIT_BY_ISO.has(iso)) return;
    setHover(null);
    setSelectedIso(iso);

    const wrap = wrapRef.current;
    const pathEl = visitedPathRefs.current[iso];
    if (!wrap) return;

    let targetCx = window.innerWidth * 0.5;
    let targetCy = window.innerHeight * 0.5;
    if (pathEl) {
      const rect = pathEl.getBoundingClientRect();
      const countryCenterX = rect.left + rect.width / 2;
      const countryCenterY = rect.top + rect.height / 2;
      const focusX = window.innerWidth * 0.17;
      const focusY = window.innerHeight * 0.5;
      const dx = focusX - countryCenterX;
      const dy = focusY - countryCenterY;
      const currentPanX =
        parseFloat(wrap.style.getPropertyValue("--pan-x")) || 0;
      const currentPanY =
        parseFloat(wrap.style.getPropertyValue("--pan-y")) || 0;
      targetCx = currentPanX + dx;
      targetCy = currentPanY + dy;
    }
    wrap.style.setProperty("--focus-x", `${targetCx}px`);
    wrap.style.setProperty("--focus-y", `${targetCy}px`);
  };

  const exitFocus = () => {
    setSelectedIso(null);
    const wrap = wrapRef.current;
    if (wrap) {
      // Clear focus vars so the next focus computes fresh deltas.
      wrap.style.removeProperty("--focus-x");
      wrap.style.removeProperty("--focus-y");
    }
  };

  const selectedVisit = selectedIso
    ? VISIT_BY_ISO.get(selectedIso) ?? null
    : null;

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
    <div
      className={`${styles.root} ${selectedIso ? styles.focusing : ""}`}
    >
      <div
        ref={wrapRef}
        className={`${styles.mapWrap} ${selectedIso ? styles.focused : ""}`}
        style={
          {
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
                exact country silhouette at its natural (1×) size. */}
            {visited.map((p) => (
              <clipPath key={`clip-${p.id}`} id={`country-clip-${p.id}`}>
                <path d={p.d} />
              </clipPath>
            ))}
          </defs>

          {/* Default world: filled, no stroke, neighbours blur into
              one continent silhouette. In focus mode (.root.focusing
              applied) every unvisited country gets its inline
              explode vector and the CSS rule below transforms /
              fades it out. */}
          {unvisited.map((p) => (
            <path
              key={p.id}
              d={p.d}
              className={styles.country}
              style={explodeStyleFor(p.id)}
            >
              <title>{p.name}</title>
            </path>
          ))}

          {/* Visited countries: fill layer (only the colour swaps on
              hover — no scale-up), the LiquidEther overlay for the
              currently-hovered country (clipped to its path), then a
              stroke-trace overlay that draws a 1px white outline
              around the perimeter over 1.5s on hover, then the
              hit-area path. */}
          {visitedSorted.map((p) => {
            const isActive = hover?.visit.iso === p.id;
            const isSelected = selectedIso === p.id;
            return (
              <path
                key={`visual-${p.id}`}
                d={p.d}
                className={`${styles.visitedVisual} ${
                  isActive || isSelected ? styles.visitedVisualActive : ""
                } ${isSelected ? styles.selected : ""}`}
                style={isSelected ? undefined : explodeStyleFor(p.id)}
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
            const isSelected = selectedIso === m.iso;
            return (
              <circle
                key={`dot-visual-${m.iso}`}
                cx={m.x}
                cy={m.y}
                r={2.6}
                className={`${styles.visitedDot} ${
                  isActive || isSelected ? styles.visitedDotActive : ""
                } ${isSelected ? styles.selected : ""}`}
                style={isSelected ? undefined : explodeStyleFor(m.iso)}
              />
            );
          })}

          {/* LiquidEther layer — single instance for the currently
              hovered country, clipped to its silhouette. Skipped for
              dot-only visits (Seychelles etc.): the dot is too small
              to clip the WebGL canvas to and the fluid leaks across
              the whole foreignObject rect. The colour swap on the
              dot is enough hover affordance there. */}
          {hover && visitedCountryISOs.has(hover.visit.iso) && (
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

          {/* Stroke-trace overlay — one path per visited country,
              always rendered so the CSS transition runs between
              states. CountryStroke measures the path's real length
              and inlines dasharray + dashoffset so the trace
              actually closes a full perimeter (the
              pathLength="1" recipe was leaving subpath gaps). */}
          {visited.map((p) => {
            const isSelected = selectedIso === p.id;
            return (
              <CountryStroke
                key={`stroke-${p.id}`}
                d={p.d}
                active={hover?.visit.iso === p.id || isSelected}
              />
            );
          })}

          {/* Hit area on top — captures all mouse events for the
              country. Transparent fill so it stays invisible. ref
              keeps a live handle so onCountryClick can read the
              path's screen rect and centre the map on it when
              entering focus mode. */}
          {visited.map((p) => {
            const isSelected = selectedIso === p.id;
            return (
              <path
                ref={(el) => {
                  visitedPathRefs.current[p.id] = el;
                }}
                key={`hit-${p.id}`}
                d={p.d}
                className={`${styles.visitedHit} ${
                  isSelected ? styles.selected : ""
                }`}
                style={isSelected ? undefined : explodeStyleFor(p.id)}
                onMouseEnter={() => onCountryEnter(p.id)}
                onMouseLeave={onCountryLeave}
                onClick={() => onCountryClick(p.id)}
                data-cursor="magnifier"
                aria-label={p.name}
              />
            );
          })}

          {/* Hit areas for the dot markers — bigger transparent
              circle around the visible 2.6r dot so the cursor can
              actually land on it (the visual is too small to grab
              by itself). */}
          {dotMarkers.map((m) => {
            const isSelected = selectedIso === m.iso;
            return (
              <circle
                key={`dot-hit-${m.iso}`}
                cx={m.x}
                cy={m.y}
                r={14}
                className={`${styles.visitedDotHit} ${
                  isSelected ? styles.selected : ""
                }`}
                style={isSelected ? undefined : explodeStyleFor(m.iso)}
                onMouseEnter={() => onCountryEnter(m.iso)}
                onMouseLeave={onCountryLeave}
                onClick={() => onCountryClick(m.iso)}
                data-cursor="magnifier"
                aria-label={m.name}
              />
            );
          })}
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

      <BlogCountryPlate hover={selectedIso ? null : hover} />
      <BlogCountryModal visit={selectedVisit} onClose={exitFocus} />
    </div>
  );
}
