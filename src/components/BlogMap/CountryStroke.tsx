"use client";

import { motion } from "motion/react";
import styles from "./BlogMap.module.css";

/**
 * Stroke-trace overlay for a single visited country. Uses Framer
 * Motion's motion.path + pathLength animation, which under the hood
 * applies stroke-dasharray + stroke-dashoffset normalised against
 * the path's real length and renders via Web Animations API. Three
 * earlier approaches (CSS transition on dashoffset, JS rAF +
 * imperative inline-style, SVG <animate> SMIL) each had a different
 * failure mode (incomplete close on multi-subpath, compositor
 * dropping inline style during LiquidEther repaint, partial
 * disappear after freeze). motion.path is well-tested across
 * browsers for exactly this "draw an SVG outline" effect.
 */
const STROKE_TRACE_MS = 1500;

export default function CountryStroke({
  d,
  active,
}: {
  d: string;
  active: boolean;
}) {
  return (
    <motion.path
      d={d}
      className={`${styles.visitedStroke} ${
        active ? styles.visitedStrokeActive : ""
      }`}
      // pathLength: 0 = nothing drawn; 1 = full perimeter drawn.
      // motion handles the stroke-dasharray math internally, including
      // multi-subpath geometries (the close-point seam that broke
      // every previous approach).
      initial={false}
      animate={{ pathLength: active ? 1 : 0 }}
      transition={{
        duration: STROKE_TRACE_MS / 1000,
        ease: "linear",
      }}
    />
  );
}
