"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ParallaxSlider.module.css";

const slides = [
  "/images/parallax/1.png",
  "/images/parallax/2.webp",
  "/images/parallax/3.webp",
  "/images/parallax/4.webp",
  "/images/parallax/5.webp",
];

export default function ParallaxSlider() {
  const [active, setActive] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      target.current = {
        x: (e.clientX - cx) / cx,
        y: (e.clientY - cy) / cy,
      };
    };
    window.addEventListener("mousemove", handle);

    const loop = () => {
      setMouse((prev) => ({
        x: prev.x + (target.current.x - prev.x) * 0.08,
        y: prev.y + (target.current.y - prev.y) * 0.08,
      }));
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", handle);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div
        className={styles.bg}
        style={{
          backgroundImage: `url(/images/parallax/bg.png)`,
          transform: `scale(1.08) translate(${mouse.x * -12}px, ${mouse.y * -12}px)`,
        }}
      />
      <div className={styles.slider}>
        {slides.map((src, i) => (
          <div
            key={src}
            className={`${styles.slide} ${i === active ? styles.active : ""}`}
            style={{
              backgroundImage: `url(${src})`,
              transform: `translate(${mouse.x * 20}px, ${mouse.y * 20}px)`,
            }}
          />
        ))}
      </div>
      <div className={styles.dots}>
        {slides.map((_, i) => (
          <button
            key={i}
            className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
            onClick={() => setActive(i)}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
