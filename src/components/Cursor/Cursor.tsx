"use client";

import { useEffect, useState } from "react";
import styles from "./Cursor.module.css";

type CursorShape =
  | "default"
  | "hover"
  | "arrow-left"
  | "arrow-right"
  | "arrow-up"
  | "arrow-down"
  | "picture";

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
          v === "picture"
        )
          return v;
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
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls} style={{ left: pos.x, top: pos.y }} />;
}
