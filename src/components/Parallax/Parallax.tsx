"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Parallax.module.css";

/** Five-layer mountain parallax for the order page header.
 *  - Horizontal shift from mouse position (back layers move less)
 *  - Vertical shift from page scroll (front layers move more, creating depth)
 */
export default function Parallax() {
  const [mouseX, setMouseX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const frameRef = useRef<number | null>(null);
  const mouseTargetRef = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      mouseTargetRef.current = (e.clientX - cx) / cx; // -1..1
    };
    const onScroll = () => setScrollY(window.scrollY);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("scroll", onScroll, { passive: true });

    const loop = () => {
      setMouseX((prev) => prev + (mouseTargetRef.current - prev) * 0.07);
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // factor = mouse-driven horizontal shift (back moves less, front moves more)
  // depth  = scroll-driven VERTICAL shift. Positive = layer resists scroll (appears
  //          stationary, "far away"). Near-zero = layer scrolls with the page.
  const layers = [
    { cls: styles.layer5, factor: 6, depth: 0.35 },
    { cls: styles.layer4, factor: 12, depth: 0.2 },
    { cls: styles.layer3, factor: 22, depth: 0.1 },
    { cls: styles.layer2, factor: 34, depth: 0.04 },
    { cls: styles.layer1, factor: 50, depth: 0 },
  ];

  return (
    <>
      {layers.map((l, i) => {
        const tx = -mouseX * l.factor;
        // Positive depth means the layer moves DOWN as the page scrolls, which
        // offsets the natural upward scroll and makes the layer linger on screen.
        const ty = scrollY * l.depth;
        return (
          <div
            key={i}
            className={`${styles.layer} ${l.cls}`}
            style={{ transform: `translate3d(${tx}px, ${ty}px, 0)` }}
          >
            <div className={styles.image} />
          </div>
        );
      })}
    </>
  );
}
