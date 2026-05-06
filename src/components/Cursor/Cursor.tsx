"use client";

import { CSSProperties, useEffect, useState } from "react";
import styles from "./Cursor.module.css";

type CursorShape =
  | "default"
  | "hover"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-down"
  | "picture"
  | "magnifier";

type Props = {
  variant?: "light" | "dark";
};

export default function Cursor({ variant = "light" }: Props) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [shape, setShape] = useState<CursorShape>("default");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isTouch = window.matchMedia("(hover: none)").matches;
    if (isTouch) return;

    setVisible(true);

    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });

    // Precedence for determining cursor shape:
    //   1. data-cursor="arrow-left|arrow-right|picture" (explicit)
    //   2. interactive tag (button/link/…)           -> hover (small dot)
    //   3. otherwise                                 -> default ring
    const shapeForTarget = (t: EventTarget | null): CursorShape => {
      if (!(t instanceof Element)) return "default";
      const explicit = t.closest("[data-cursor]");
      if (explicit) {
        const v = explicit.getAttribute("data-cursor");
        if (
          v === "arrow-left" ||
          v === "arrow-right" ||
          v === "arrow-up" ||
          v === "arrow-down" ||
          v === "picture" ||
          v === "magnifier"
        )
          return v;
        if (v === "hover") return "hover";
        // Empty / unknown explicit values fall through to the
        // interactive-element check below so e.g. a button inside a
        // magnifier-cursor card still gets the dot cursor.
      }
      const interactive = t.closest(
        'a, button, [role="button"], input, textarea, select, [data-cursor-hover]'
      );
      if (interactive) return "hover";
      return "default";
    };

    const onOver = (e: MouseEvent) => setShape(shapeForTarget(e.target));

    window.addEventListener("mousemove", move);
    window.addEventListener("mouseover", onOver);

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseover", onOver);
    };
  }, []);

  if (!visible) return null;

  const cls = [
    styles.cursor,
    variant === "dark" ? styles.dark : "",
    shape === "hover" ? styles.hover : "",
    shape === "arrow-left" ? styles.arrowLeft : "",
    shape === "arrow-right" ? styles.arrowRight : "",
    shape === "arrow-up" ? styles.arrowUp : "",
    shape === "arrow-down" ? styles.arrowDown : "",
    shape === "picture" ? styles.picture : "",
    shape === "magnifier" ? styles.magnifier : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Position via CSS variables that feed a translate3d transform
  // (see Cursor.module.css). Avoids the per-frame layout / paint
  // hit you'd get from animating `left` and `top` directly — the
  // cursor stays on its own GPU compositor layer and tracks the
  // pointer cleanly even while the rest of the page is busy
  // (mix-blend logo, sliding bridge, etc.).
  const style = {
    "--cursor-x": `${pos.x}px`,
    "--cursor-y": `${pos.y}px`,
  } as CSSProperties;

  return <div className={cls} style={style} />;
}
