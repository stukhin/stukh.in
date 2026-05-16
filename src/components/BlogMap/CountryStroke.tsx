"use client";

import { useEffect, useRef } from "react";
import styles from "./BlogMap.module.css";

/**
 * Stroke-trace overlay for a single visited country. Drives the
 * draw-the-outline animation imperatively via the Web Animations
 * API on stroke-dashoffset, with stroke-dasharray fixed to the
 * path's total length.
 *
 * Why not motion.path / pathLength? Earlier attempts:
 *
 *  1. CSS transition on stroke-dashoffset — incomplete close on
 *     multi-subpath countries (Greece + islands, USA + Alaska).
 *  2. rAF + inline style writes per frame — the compositor would
 *     occasionally drop the inline style during a LiquidEther
 *     repaint pass, leaving the trace half-drawn.
 *  3. SVG <animate> SMIL with fill="freeze" — same partial-freeze
 *     symptom on a subset of countries.
 *  4. motion.path with `pathLength: 0 → 1` — worked for a while,
 *     then regressed for 50m TopoJSON paths (the user saw country
 *     outlines that never finished closing). Likely the
 *     pathLength SVG attribute motion sets under the hood
 *     interacts badly with some compound subpath geometries.
 *
 * Current approach: getTotalLength() once per path, set dasharray
 * to that value (single-value shorthand → repeats as dash/gap of
 * the same length). SVG resets the dash pattern at the start of
 * each subpath, and any subpath is shorter than the sum-of-all
 * length, so when dashoffset hits 0 every subpath is fully inside
 * its first "dash" period — full perimeter drawn for ALL subpaths.
 * WAAPI runs the animation on the compositor without writing
 * inline style each frame, so LiquidEther repaints don't disturb
 * it.
 */
const STROKE_TRACE_MS = 1500;

type Props = {
  d: string;
  active: boolean;
};

export default function CountryStroke({ d, active }: Props) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const totalLengthRef = useRef(0);
  const animationRef = useRef<Animation | null>(null);

  // Measure the path's total length once per `d`. getTotalLength()
  // sums every subpath, so multi-subpath countries get a length
  // that covers every island. dasharray=total + dashoffset=total
  // is the "fully hidden" initial state.
  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    if (!Number.isFinite(total) || total === 0) return;
    totalLengthRef.current = total;
    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = active ? "0" : `${total}`;
  }, [d, active]);

  // Active toggled: cancel any in-flight animation and run a new
  // one from the path's CURRENT computed dashoffset to the target
  // (0 = drawn, total = hidden). Starting from the live computed
  // value lets a quick hover-in / hover-out reverse smoothly
  // mid-way instead of snapping.
  useEffect(() => {
    const path = pathRef.current;
    const total = totalLengthRef.current;
    if (!path || !total) return;

    animationRef.current?.cancel();
    const from =
      parseFloat(getComputedStyle(path).strokeDashoffset || `${total}`) || 0;
    const to = active ? 0 : total;

    const animation = path.animate(
      [
        { strokeDashoffset: `${from}` },
        { strokeDashoffset: `${to}` },
      ],
      {
        duration: STROKE_TRACE_MS,
        easing: "linear",
        fill: "forwards",
      }
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
    };
  }, [active]);

  return (
    <path
      ref={pathRef}
      d={d}
      className={`${styles.visitedStroke} ${
        active ? styles.visitedStrokeActive : ""
      }`}
    />
  );
}
