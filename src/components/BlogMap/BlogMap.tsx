"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import LiquidEther from "../LiquidEther/LiquidEther";
import BlogCountryPlate, {
  type CountryHoverState,
} from "./BlogCountryPlate";
import BlogCountryModal from "./BlogCountryModal";
import CountryLayer, { CountryStrokesAndHits } from "./CountryLayer";
import DotLayer, { DotHits } from "./DotLayer";
import { buildMapProjection, type Projection } from "./mapProjection";
import { VISIT_BY_ISO } from "./visits";
import styles from "./BlogMap.module.css";

// Zoom. Floor at 1.0 = the map sized to fill the viewport
// vertically with no parallax slack. Default ZOOM_INITIAL is 1.2
// so the page lands on a slightly cropped map and the cursor can
// pan around it from frame zero. Max capped at 2.0 (= 2× the
// fully-zoomed-out state) per the user's "max twice the
// outermost view" spec.
const ZOOM_MIN = 1.0;
const ZOOM_MAX = 2.0;
const ZOOM_INITIAL = 1.2;
const ZOOM_STEP = 0.005;
// Pinch gestures on macOS trackpads fire wheel events with
// e.ctrlKey === true and very small deltaY values per "tick" —
// scale the per-event zoom up so the gesture feels responsive.
const PINCH_STEP = 0.04;
const ZOOM_BUTTON_STEP = 0.22;

// How long after a mouseleave we wait before clearing the hover
// state. Smooths cursor-near-edge wobble that would otherwise rapid-
// fire enter/leave events as the user feathers the boundary.
const LEAVE_DEBOUNCE_MS = 80;

// LiquidEther palette — warm tones that pair with the page's cream
// background and the visited country's accent fill.
const LIQUID_COLORS = ["#c14a3a", "#f08a5d", "#ffd2b3"];

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
  const projectionRef = useRef<Projection | null>(null);
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
   * paths fade to a barely-visible neutral gray, the map glides
   * to centre the country at ~60 % vh in the left half of the
   * viewport, and a detail panel slides in from the right.
   * Tracked by ISO so the selected path can opt out of the
   * focusing CSS rules.
   */
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  /**
   * `closing` flips on for ~1.4 s after exitFocus runs, applying
   * the same 1.4 s transition curve to .mapWrap as the focus
   * entry. Without this, removing .focused would fall back to
   * .mapWrap's base 0.18 s transition (used for cursor parallax)
   * and the close animation would feel like an instant snap-back
   * even though the entry had a full 1.4 s glide. The class is
   * dropped after the transition completes so cursor parallax
   * gets its snappy timing back.
   */
  const [closing, setClosing] = useState(false);
  const closingTimerRef = useRef<number | null>(null);
  // Mirror of selectedIso for the imperatively-updated coords
  // readout (same trick as hoverRef). flush() reads this and bails
  // when a country is in focus mode — the side panel covers the
  // right half and the lat/long would just clutter it.
  const selectedIsoRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIsoRef.current = selectedIso;
    if (selectedIso && coordsRef.current) {
      coordsRef.current.style.opacity = "0";
    }
  }, [selectedIso]);
  /**
   * Refs to each visited country's hit path. Used to measure the
   * path's screen position right before entering focus mode so we
   * can translate the map to centre the country on the left third
   * of the viewport. Hit paths are 1:1 with the visible silhouette
   * now (we removed the pre-scale), so getBoundingClientRect on
   * them gives the exact rect we want.
   */
  const visitedPathRefs = useRef<Record<string, SVGPathElement | null>>({});

  // Project all country paths once on mount. The viewBox is
  // tightened to the projected feature bounds (no internal padding)
  // so the northernmost / southernmost lands touch the SVG top +
  // bottom edges; combined with CSS height: 100% on the SVG, that
  // lets Antarctica's coastline sit flush with the viewport bottom.
  // Logic lives in mapProjection.ts — pure cartographic glue, no
  // React state, kept out of this file to make the component read.
  const { paths, viewBoxStr, mapAspect, vb, projection } = useMemo(
    () => buildMapProjection(),
    []
  );

  // Keep the ref in sync for the imperative lat/long flush below
  // (which can't capture `projection` from the render scope without
  // re-creating its listener every render). Writing a ref during
  // render is fine: refs are mutable and don't drive React updates.
  projectionRef.current = projection;

  // Wheel-zoom + cursor-driven pan on desktop; drag-to-pan + pinch-
  // zoom on touch devices. All paths are imperative (no React state)
  // so high-frequency events don't re-render. Pan is clamped so the
  // map's bounding box always covers the viewport — at zoom 1.0 the
  // map fills vertically with only horizontal overflow pannable;
  // zooming in opens up vertical pan room too. Parallax was dropped
  // on /blog because it conflicted with the strict "Antarctica
  // touches the bottom edge" requirement.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    if (typeof window === "undefined") return;

    const isTouch = window.matchMedia("(hover: none)").matches;

    wrap.style.setProperty("--zoom", String(ZOOM_INITIAL));
    wrap.style.setProperty("--pan-x", "0px");
    wrap.style.setProperty("--pan-y", "0px");

    /**
     * Compute max pan slack at the current zoom. The map's baseline
     * height = wrap height (CSS height: 100% on the SVG); width =
     * height × mapAspect. Multiplying both by zoom gives the visible
     * map dims, and the half of (visible − viewport) is the maximum
     * slack on each axis. At zoom 1 slack is 0 (baseline = wrap), so
     * the map stays perfectly centred.
     */
    const maxPan = () => {
      const wrapH = wrap.clientHeight;
      const wrapW = wrap.clientWidth;
      const baselineH = wrapH;
      const baselineW = baselineH * mapAspect;
      const z = zoomRef.current;
      return {
        x: Math.max(0, (baselineW * z - wrapW) / 2),
        y: Math.max(0, (baselineH * z - wrapH) / 2),
      };
    };

    /**
     * Desktop cursor-driven pan:
     *   pan_x = (1 − 2·cx) · maxPan_X
     *   cx = 0   → +maxPan_X (map shifted right → see LEFT)
     *   cx = 1   → −maxPan_X (map shifted left  → see RIGHT)
     *   cx = 0.5 → 0          (centred)
     */
    const recomputePan = () => {
      const m = maxPan();
      const panX = (1 - 2 * cursorRef.current.mx) * m.x;
      const panY = (1 - 2 * cursorRef.current.my) * m.y;
      wrap.style.setProperty("--pan-x", `${panX}px`);
      wrap.style.setProperty("--pan-y", `${panY}px`);
    };
    recomputePanRef.current = recomputePan;

    /**
     * Touch pan: explicit drag delta. Refs hold the current pan
     * absolute (panXRef / panYRef) plus the gesture's baseline
     * (touch x/y + pan x/y at gesture start) so onTouchMove can
     * compute newPan = base + delta and applyPan can clamp it
     * against the current maxPan.
     */
    let panXAbs = 0;
    let panYAbs = 0;
    type TouchMode = "idle" | "pan" | "pinch";
    let mode: TouchMode = "idle";
    let panBaseX = 0;
    let panBaseY = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    let pinchStartDist = 0;
    let pinchStartZoom = 1;
    let dragExceededTapSlop = false;

    const applyPan = () => {
      const m = maxPan();
      panXAbs = Math.max(-m.x, Math.min(m.x, panXAbs));
      panYAbs = Math.max(-m.y, Math.min(m.y, panYAbs));
      wrap.style.setProperty("--pan-x", `${panXAbs}px`);
      wrap.style.setProperty("--pan-y", `${panYAbs}px`);
    };

    const touchDist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

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
      // Trackpad pinch gestures arrive as wheel events with ctrlKey
      // = true on every browser; the deltaY ticks are much smaller
      // than a regular scroll wheel, so we use a wider per-event
      // step for pinch to keep the gesture feeling 1:1 with the
      // user's fingers.
      const isPinch = e.ctrlKey;
      const step = isPinch ? PINCH_STEP : ZOOM_STEP;
      const next = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, zoomRef.current - e.deltaY * step)
      );
      // At a zoom limit and wheeling further in the same direction
      // — no zoom change to make. Let the event through so the
      // global page-wheel handler can decide what to do with it.
      if (next === zoomRef.current) return;
      e.preventDefault();
      zoomRef.current = next;
      wrap.style.setProperty("--zoom", String(zoomRef.current));
      recomputePan();
    };

    const onTouchStart = (e: TouchEvent) => {
      // Skip if the detail modal is open — its own touches stay
      // inside the panel (pointer-events: auto on .backdrop) and
      // shouldn't drive map pan/zoom. Window-level registration
      // means the event still fires here; gate explicitly.
      if (selectedIsoRef.current) return;
      if (e.touches.length === 2) {
        // Two-finger pinch: block the native page-zoom gesture and
        // start tracking the distance between fingers.
        e.preventDefault();
        mode = "pinch";
        pinchStartDist = touchDist(e.touches[0], e.touches[1]);
        pinchStartZoom = zoomRef.current;
        dragExceededTapSlop = true;
      } else if (e.touches.length === 1) {
        // Single-finger gesture: start in pan mode, but DON'T
        // preventDefault — a small finger movement should still
        // resolve to a click (country tap → modal). Only when the
        // drag exceeds the tap slop do we suppress the synthetic
        // click and start panning.
        mode = "pan";
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        panBaseX = panXAbs;
        panBaseY = panYAbs;
        dragExceededTapSlop = false;
      }
    };

    const TAP_SLOP_PX = 6;

    const onTouchMove = (e: TouchEvent) => {
      if (mode === "idle") return;
      if (mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        if (pinchStartDist <= 0) return;
        const d = touchDist(e.touches[0], e.touches[1]);
        const next = Math.max(
          ZOOM_MIN,
          Math.min(ZOOM_MAX, pinchStartZoom * (d / pinchStartDist))
        );
        if (next !== zoomRef.current) {
          zoomRef.current = next;
          wrap.style.setProperty("--zoom", String(next));
          applyPan();
        }
        return;
      }
      if (mode === "pan" && e.touches.length === 1) {
        const dx = e.touches[0].clientX - touchStartX;
        const dy = e.touches[0].clientY - touchStartY;
        if (
          !dragExceededTapSlop &&
          Math.abs(dx) < TAP_SLOP_PX &&
          Math.abs(dy) < TAP_SLOP_PX
        ) {
          // Still within tap slop — let the touch resolve to a
          // click (country tap → modal) and don't preventDefault.
          return;
        }
        // Past slop: this is a drag, not a tap. preventDefault to
        // (a) stop the page from scrolling and (b) suppress the
        // synthetic click that would otherwise fire on touchend.
        e.preventDefault();
        dragExceededTapSlop = true;
        panXAbs = panBaseX + dx;
        panYAbs = panBaseY + dy;
        applyPan();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        mode = "idle";
      } else if (e.touches.length === 1 && mode === "pinch") {
        // User lifted one finger mid-pinch — drop to pan mode
        // picking up from the remaining finger as the new baseline.
        mode = "pan";
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        panBaseX = panXAbs;
        panBaseY = panYAbs;
        dragExceededTapSlop = true;
      }
    };

    const onResize = () => {
      if (isTouch) applyPan();
      else recomputePan();
    };

    // Initial pan: cursor model on desktop, identity on touch.
    if (!isTouch) recomputePan();

    if (isTouch) {
      // Touch listeners on `window`, not `wrap`. .root + .mapWrap +
      // .map all carry `pointer-events: none` so EdgeNav clicks fall
      // through on cream-paper areas; if we register on wrap, only
      // touches that land directly on a visited country path
      // (pointer-events: fill) bubble up to it. Touches on cream
      // paper would never fire the handlers — that's what caused the
      // "map sometimes pans, sometimes doesn't" feel on mobile.
      // Window catches every touch regardless of hit target; we gate
      // at the handler level on selectedIsoRef so the modal owns its
      // own touches.
      window.addEventListener("touchstart", onTouchStart, { passive: false });
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd, { passive: true });
      window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    } else {
      window.addEventListener("mousemove", onMove);
      wrap.addEventListener("wheel", onWheel, { passive: false });
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (isTouch) {
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
      } else {
        window.removeEventListener("mousemove", onMove);
        wrap.removeEventListener("wheel", onWheel);
        if (raf !== null) cancelAnimationFrame(raf);
      }
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
      // visited country OR while a country is in focus mode (the
      // side panel covers the readout's preferred location and
      // the country plate / panel already carries the location
      // info).
      if (hoverRef.current || selectedIsoRef.current) {
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
   * Enter focus mode for the clicked visited country. Scales the
   * map so the country's bounding box fills ~60% of the viewport
   * height (with 20% empty padding above and below), and centres
   * it horizontally between the left edge and the right-side
   * detail panel. CSS variables --focus-x / --focus-y / --focus-
   * scale are written to .mapWrap; the .mapWrap.focused rule
   * applies them as a single transition so the country glides
   * into place while the rest of the world fades to a neutral
   * gray (see .focusing rules below).
   */
  const onCountryClick = (iso: string) => {
    if (!VISIT_BY_ISO.has(iso)) return;
    setHover(null);
    setSelectedIso(iso);

    // Mobile: skip the map-glide-and-scale animation entirely. The
    // detail panel covers the whole viewport on touch so centring
    // the country in the empty space is pointless — and the
    // .mapWrap.focused transform would just stash a default
    // identity matrix on top of the user's current pan/zoom.
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none)").matches
    ) {
      return;
    }

    const wrap = wrapRef.current;
    const pathEl = visitedPathRefs.current[iso];
    if (!wrap || !pathEl) return;

    const rect = pathEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Side panel width matches BlogCountryModal's
    // clamp(360px, 60vw, 880px).
    const panelWidth = Math.max(360, Math.min(vw * 0.6, 880));
    const availableWidth = vw - panelWidth;
    // Country target: centred in the empty space to the left of the
    // panel, vertically dead-centre.
    const targetCx = availableWidth / 2;
    const targetCy = vh / 2;
    // Country target box: ≤ 60 % of viewport height (20 % padding
    // top + bottom) AND ≤ 80 % of the available width (10 % padding
    // on each side between the left edge and the panel divider).
    // Pick the smaller of the two scales so neither dimension
    // exceeds its cap. Floor at 1× so big countries (Russia,
    // Brazil) stay at their current size instead of zooming out.
    const targetH = vh * 0.6;
    const targetW = availableWidth * 0.8;
    const heightRatio = targetH / rect.height;
    const widthRatio = targetW / rect.width;
    const scaleRatio = Math.max(1, Math.min(heightRatio, widthRatio));

    // We're REPLACING the wrap's transform (the .focused rule uses
    // --focus-* vars in place of --pan-* / --zoom). Compute the
    // absolute focus values that put the country at (targetCx,
    // targetCy) at the new scale, accounting for the wrap's
    // transform-origin (viewport centre) and the current pan/
    // zoom that's about to be replaced.
    const currentZoom = zoomRef.current || 1;
    const newScale = currentZoom * scaleRatio;
    const panX =
      parseFloat(wrap.style.getPropertyValue("--pan-x")) || 0;
    const panY =
      parseFloat(wrap.style.getPropertyValue("--pan-y")) || 0;
    const focusX =
      targetCx - vw / 2 - (cx - vw / 2 - panX) * scaleRatio;
    const focusY =
      targetCy - vh / 2 - (cy - vh / 2 - panY) * scaleRatio;

    wrap.style.setProperty("--focus-x", `${focusX}px`);
    wrap.style.setProperty("--focus-y", `${focusY}px`);
    wrap.style.setProperty("--focus-scale", `${newScale}`);
  };

  const exitFocus = useCallback(() => {
    setSelectedIso(null);
    setClosing(true);
    if (closingTimerRef.current !== null) {
      window.clearTimeout(closingTimerRef.current);
    }
    closingTimerRef.current = window.setTimeout(() => {
      setClosing(false);
      closingTimerRef.current = null;
      const wrap = wrapRef.current;
      if (wrap) {
        // Clear focus vars so the next focus computes fresh deltas.
        wrap.style.removeProperty("--focus-x");
        wrap.style.removeProperty("--focus-y");
        wrap.style.removeProperty("--focus-scale");
      }
    }, 1400);
  }, []);

  // Document-level click outside the right panel exits focus mode.
  // The panel marks itself with [data-blog-country-panel]; clicks
  // anywhere else (map, empty paper, even another country) close
  // the current view. Escape also closes (BlogCountryModal owns
  // that listener).
  useEffect(() => {
    if (!selectedIso) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target && target.closest("[data-blog-country-panel]")) return;
      exitFocus();
    };
    // pointerdown fires earlier than click — the user's "down" on
    // the map is the cleanest signal to close, before any selection
    // logic on visited paths fires.
    document.addEventListener("pointerdown", onPointerDown);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown);
  }, [selectedIso, exitFocus]);

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
   * Visits with explicit `coords` always render as a circle
   * marker on top of the map, regardless of whether the country
   * exists in the TopoJSON. Tiny island nations (Seychelles,
   * Maldives) are practically invisible in their topology
   * silhouette at default zoom — the dot makes them clickable.
   * For visits that ALSO have a country path (e.g. if the topology
   * resolution is bumped up), the dot just sits over the country
   * fill as an emphasis marker; click hits whichever happens to
   * be on top (same handler either way). The earlier
   * `!visitedCountryISOs.has(v.iso)` filter dropped Seychelles
   * the moment 50m TopoJSON started including it as a tiny
   * polygon — user reported "Сейшелы пропали".
   */
  const visitedCountryISOs = new Set(visited.map((p) => p.id));
  const dotMarkers = useMemo(() => {
    return Array.from(VISIT_BY_ISO.values())
      .filter((v) => v.coords)
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
  }, [projection]);

  return (
    <div
      className={`${styles.root} ${selectedIso ? styles.focusing : ""}`}
    >
      <div
        ref={wrapRef}
        className={`${styles.mapWrap} ${selectedIso ? styles.focused : ""} ${
          closing ? styles.closing : ""
        }`}
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

          {/* Country geometry: unvisited fills + visited fills.
              Visited stroke + hit areas render LATER, after the
              LiquidEther layer below — SVG paint order = z-stacking,
              and the stroke needs to draw on top of the fluid. */}
          <CountryLayer
            unvisited={unvisited}
            visited={visited}
            visitedSorted={visitedSorted}
            hoveredIso={hover?.visit.iso ?? null}
            selectedIso={selectedIso}
            onEnter={onCountryEnter}
            onLeave={onCountryLeave}
            onClick={onCountryClick}
            visitedPathRefs={visitedPathRefs}
          />

          {/* Dot markers for tiny island visits (Seychelles, etc.) —
              fill layer here, hit area renders last for click
              capture above everything else. */}
          <DotLayer
            dotMarkers={dotMarkers}
            hoveredIso={hover?.visit.iso ?? null}
            selectedIso={selectedIso}
          />

          {/* LiquidEther layer — single instance for the currently
              hovered country, clipped to its silhouette. Skipped
              for dot-style visits (where v.coords is set —
              Seychelles, Maldives, etc.): the dot is too small
              to clip the WebGL canvas to. Earlier we used "not in
              topology" as the dot flag, but 50m TopoJSON includes
              tiny island nations as polygons, so the better signal
              is hover.visit.coords being set. */}
          {hover &&
            !hover.visit.coords &&
            visitedCountryISOs.has(hover.visit.iso) && (
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

          {/* Stroke trace + hit areas, drawn ABOVE the fluid layer
              so the trace reads as drawn over the bubbling colour
              and pointer events land on the hit paths. */}
          <CountryStrokesAndHits
            visited={visited}
            hoveredIso={hover?.visit.iso ?? null}
            selectedIso={selectedIso}
            onEnter={onCountryEnter}
            onLeave={onCountryLeave}
            onClick={onCountryClick}
            visitedPathRefs={visitedPathRefs}
          />

          {/* Dot hit areas LAST — 14r transparent circle around the
              2.6r visible dot so taps register on tiny islands. */}
          <DotHits
            dotMarkers={dotMarkers}
            selectedIso={selectedIso}
            onEnter={onCountryEnter}
            onLeave={onCountryLeave}
            onClick={onCountryClick}
          />
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
