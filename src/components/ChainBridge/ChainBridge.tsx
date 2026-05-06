"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_ORDER } from "@/lib/pageOrder";
import { PAGE_VISUALS } from "@/lib/pageVisuals";
import styles from "./ChainBridge.module.css";

const BASE_DURATION = 800;
const PER_EXTRA_STEP = 320;
const FADE_IN_MS = 250;
const FADE_OUT_MS = 280;

type ChainEvent = CustomEvent<{ from: string; to: string }>;

export default function ChainBridge() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [opaque, setOpaque] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [fading, setFading] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(0);
  const [duration, setDuration] = useState(BASE_DURATION);
  const timersRef = useRef<number[]>([]);

  // Warm the HTTP cache on mount so the very first cross-page slide
  // doesn't hitch fetching the bg images. The Image() instances go
  // out of scope after the effect runs; the browser keeps the bytes
  // in its cache.
  useEffect(() => {
    Object.values(PAGE_VISUALS).forEach((v) => {
      if (!v.bg) return;
      const img = new window.Image();
      img.src = v.bg;
    });
  }, []);

  useEffect(() => {
    const clearTimers = () => {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    };

    const clearShellClasses = () => {
      document.documentElement.classList.remove(
        "chain-active",
        "chain-settling"
      );
    };

    const handler = (raw: Event) => {
      const e = raw as ChainEvent;
      const fIdx = PAGE_ORDER.indexOf(e.detail.from);
      const tIdx = PAGE_ORDER.indexOf(e.detail.to);
      if (fIdx === -1 || tIdx === -1 || fIdx === tIdx) return;

      const distance = Math.abs(tIdx - fIdx);
      const dur = BASE_DURATION + (distance - 1) * PER_EXTRA_STEP;

      clearTimers();
      clearShellClasses();
      setFromIdx(fIdx);
      setToIdx(tIdx);
      setDuration(dur);
      setOpaque(false);
      setAnimating(false);
      setFading(false);
      // Mount the bridge at opacity 0 (default in CSS); it fades in
      // over FADE_IN_MS so the OLD page (and its gallery) blends
      // out smoothly behind the rising overlay instead of being
      // covered by an instant black screen.
      setActive(true);

      // Two RAFs to ensure the initial opaque=false / animating=false
      // state is committed before flipping it on — without that the
      // CSS transition would skip its start keyframe.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpaque(true));
      });

      // After the fade-in completes, kick off the route change AND
      // start the strip animation. Holding off the route swap until
      // the bridge is fully opaque keeps the OLD page DOM alive (and
      // visible behind the fading bridge) so the user reads it as
      // "page softly disappearing" rather than an abrupt cut.
      timersRef.current.push(
        window.setTimeout(() => {
          // chain-active toggles the logo's mix-blend-mode so the
          // boundary effect cuts through the glyphs while the
          // strip is moving.
          document.documentElement.classList.add("chain-active");
          router.push(e.detail.to);
          setAnimating(true);
        }, FADE_IN_MS)
      );

      // End of the strip animation: hand off from chain-active to
      // chain-settling. The shell snaps to its data-theme colour
      // with no transition (no flash white), and the bridge starts
      // fading out, revealing the NEW page's gallery underneath.
      timersRef.current.push(
        window.setTimeout(() => {
          setFading(true);
          document.documentElement.classList.remove("chain-active");
          document.documentElement.classList.add("chain-settling");
        }, FADE_IN_MS + dur)
      );
      // End of the fade-out: drop chain-settling, unmount.
      timersRef.current.push(
        window.setTimeout(() => {
          setActive(false);
          setOpaque(false);
          setAnimating(false);
          setFading(false);
          document.documentElement.classList.remove("chain-settling");
        }, FADE_IN_MS + dur + FADE_OUT_MS)
      );
    };

    window.addEventListener("chainNavigate", handler);
    return () => {
      window.removeEventListener("chainNavigate", handler);
      clearTimers();
      clearShellClasses();
    };
  }, [router]);

  if (!active) return null;

  const style: CSSProperties = {
    "--bridge-from": `${-fromIdx * 100}vh`,
    "--bridge-to": `${-toIdx * 100}vh`,
    "--bridge-duration": `${duration}ms`,
    "--bridge-fade-in": `${FADE_IN_MS}ms`,
    "--bridge-fade-out": `${FADE_OUT_MS}ms`,
  } as CSSProperties;

  const bridgeClasses = [
    styles.bridge,
    opaque ? styles.opaque : "",
    fading ? styles.fading : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={bridgeClasses} style={style} aria-hidden="true">
      <div className={`${styles.strip} ${animating ? styles.animating : ""}`}>
        {PAGE_ORDER.map((href) => {
          const v = PAGE_VISUALS[href] || { color: "#0a0a0c" };
          return (
            <div
              key={href}
              className={styles.slide}
              style={{
                backgroundColor: v.color,
                backgroundImage: v.bg ? `url(${v.bg})` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
