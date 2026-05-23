"use client";

import { CSSProperties, useEffect, useState } from "react";
import {
  getLastMousePosition,
  setLastMousePosition,
} from "@/lib/mousePosition";
import { MQ, useMediaQuery } from "@/lib/useMediaQuery";
import styles from "./Cursor.module.css";

type CursorShape =
  | "default"
  | "hover"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-down"
  | "picture"
  | "magnifier"
  | "grab"
  | "grabbing";

type Props = {
  variant?: "light" | "dark";
};

export default function Cursor({ variant = "light" }: Props) {
  // Initial position read from the module-level store so the cursor
  // re-mounts at the last known location after a page transition.
  // Without this it would re-init at (-100, -100) and only snap to
  // the real cursor position on the next mousemove — meaning after
  // a chain-bridge fade-out finishes the cursor would "appear
  // abruptly" only when the user nudged the mouse, which the user
  // explicitly flagged. Lazy initializer so the read happens once
  // at mount, not every render.
  const [pos, setPos] = useState(() => getLastMousePosition());
  const [shape, setShape] = useState<CursorShape>("default");
  const [visible, setVisible] = useState(false);
  const isTouch = useMediaQuery(MQ.TOUCH);

  useEffect(() => {
    if (isTouch) return;

    setVisible(true);

    const move = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      // Mirror to module storage so the next Cursor instance (after
      // a route change) can pick up where we left off.
      setLastMousePosition(e.clientX, e.clientY);
    };

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
          v === "magnifier" ||
          v === "grab" ||
          v === "grabbing"
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
  }, [isTouch]);

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
    shape === "grab" ? styles.grab : "",
    shape === "grabbing" ? styles.grabbing : "",
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
