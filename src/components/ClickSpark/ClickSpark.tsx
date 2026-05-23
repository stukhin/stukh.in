"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Click-spark overlay. Renders a fixed-position transparent canvas
 * over the whole viewport and listens for clicks on `window`. When
 * the click target is a navigation link (`<a href>` to a same-tab
 * destination) OR an opt-in `data-spark="nav"` element, a burst of
 * radial spark lines emits from the click coordinate.
 *
 * Filter rationale: the user wanted sparks only when they go to
 * another page — not on every click in the document. Burger /
 * dot indicators / download buttons / dialog X's stay silent.
 * Wheel + swipe navigations don't have a click coordinate and
 * are skipped too (matches "только в случае, если ты переходишь
 * на другую страницу").
 *
 * Vendored from React Bits, ported from JS → TS and refactored
 * from a children-wrapper into a global overlay. Renders nothing
 * if rendered server-side (canvas APIs unavailable) — relies on
 * the layout mounting it after Preloader + ChainBridge.
 */
type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

type Spark = {
  x: number;
  y: number;
  angle: number;
  startTime: number;
  /** Cached colour at spawn time. Re-reading getComputedStyle every
   *  frame is expensive; we sample once when the spark is created
   *  and reuse it for every frame of its life. */
  color: string;
};

type Props = {
  /** Override the auto-themed spark colour. When omitted, falls back
   *  to the live `--shell-fg-strong` token from <html> (white on
   *  dark routes, black on light routes — sparks always read against
   *  the page bg). */
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  easing?: Easing;
  extraScale?: number;
};

const NAV_SELECTOR = 'a[href], [data-spark="nav"]';

export default function ClickSpark({
  sparkColor,
  sparkSize = 12,
  sparkRadius = 28,
  sparkCount = 10,
  duration = 500,
  easing = "ease-out",
  extraScale = 1.0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);

  // Size the canvas backing-store to viewport × DPR. The CSS size
  // stays at viewport pixels (set in JSX via style); the buffer is
  // upscaled for retina. ctx is fetched freshly here because dpr
  // changes survive only if we re-scale the context after resizing
  // the buffer.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window === "undefined") return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const easeFunc = useCallback(
    (t: number): number => {
      switch (easing) {
        case "linear":
          return t;
        case "ease-in":
          return t * t;
        case "ease-in-out":
          return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        default:
          return t * (2 - t);
      }
    },
    [easing]
  );

  // Render loop. Iterates sparksRef, advances each by elapsed time,
  // drops finished sparks, draws the survivors. Loop runs forever
  // (cheap when sparksRef is empty — just clearRect on an empty
  // canvas).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = (timestamp: number) => {
      // clearRect in CSS pixels (the context is already DPR-scaled).
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const elapsed = timestamp - spark.startTime;
        if (elapsed >= duration) return false;

        const progress = elapsed / duration;
        const eased = easeFunc(progress);

        const distance = eased * sparkRadius * extraScale;
        const lineLength = sparkSize * (1 - eased);

        const x1 = spark.x + distance * Math.cos(spark.angle);
        const y1 = spark.y + distance * Math.sin(spark.angle);
        const x2 = spark.x + (distance + lineLength) * Math.cos(spark.angle);
        const y2 = spark.y + (distance + lineLength) * Math.sin(spark.angle);

        ctx.strokeStyle = spark.color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        return true;
      });

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sparkSize, sparkRadius, duration, easeFunc, extraScale]);

  // Resolve the spark colour at spawn time. Explicit prop wins; else
  // read --shell-fg-strong from <html>. Trim because getPropertyValue
  // can return leading whitespace. Final fallback to white.
  const resolveColor = useCallback((): string => {
    if (sparkColor) return sparkColor;
    if (typeof window === "undefined") return "#ffffff";
    const fromTheme = getComputedStyle(document.documentElement)
      .getPropertyValue("--shell-fg-strong")
      .trim();
    return fromTheme || "#ffffff";
  }, [sparkColor]);

  // Global click listener. Filters for navigation-bound targets so
  // sparks fire only when the click takes the user somewhere new.
  // window-level so we catch every bubble; e.target.closest walks up
  // to find the actual nav element (the click might land on a child
  // span / svg inside an <a>).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;

      const navEl = target.closest(NAV_SELECTOR);
      if (!navEl) return;

      // Skip external-tab links — those don't actually leave the
      // current page from the user's POV (they open a new tab).
      if (navEl.tagName === "A") {
        const anchor = navEl as HTMLAnchorElement;
        if (anchor.target === "_blank") return;
      }

      const color = resolveColor();
      const now = performance.now();
      const sparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
        x: e.clientX,
        y: e.clientY,
        angle: (2 * Math.PI * i) / sparkCount,
        startTime: now,
        color,
      }));
      sparksRef.current.push(...sparks);
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [sparkCount, resolveColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        // Above page content + modals but below the custom cursor
        // (Cursor.module.css z-index: 200) so sparks never paint over
        // the cursor ring.
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
}
