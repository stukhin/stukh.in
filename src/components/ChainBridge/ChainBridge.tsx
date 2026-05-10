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
// Buffer between "opacity transition would finish" and "we hand off
// to the new route". The 2 RAFs we use to commit opacity 0 before
// transitioning to 1 push the actual fade END to ~FADE_IN_MS + 33ms,
// and React's microtasks need a frame or two of slack on top. Without
// this buffer the home page (and its WebGL canvas) start unmounting
// while the bridge is still ~85% opaque, and the canvas's brief
// black-clear during context-loss leaks through the bridge's
// transparency — that's the "black flash on / → next-page" the user
// kept reporting.
const ROUTE_HANDOFF_BUFFER = 80;

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

  // Warm the HTTP cache on mount AND force a decode pass so the bg
  // image is fully ready in the browser's image-decode cache by the
  // time the bridge mounts and tries to paint it. Without the
  // explicit decode(), Image().src=… only schedules the HTTP fetch;
  // the first paint of background-image: url(…) on the bridge
  // slide can still race the decode and show only the solid
  // fallback colour for a frame — that was the residual "black
  // flash" the user kept seeing on / → next-page. PAGE_VISUALS["/"]
  // .bg is also mutated by HomeSlider as it rotates, so we pre-warm
  // every home slide here regardless of the static value.
  useEffect(() => {
    const sources = new Set<string>();
    Object.values(PAGE_VISUALS).forEach((v) => {
      if (v.bg) sources.add(v.bg);
    });
    for (let i = 1; i <= 4; i++) {
      sources.add(`/images/gallery/main/desktop/${i}.webp`);
    }
    sources.forEach((src) => {
      const img = new window.Image();
      img.src = src;
      // decode() is best-effort; failures (e.g. 404) just leave the
      // fallback colour in place, same as before.
      img.decode().catch(() => {});
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

      // After the fade-in completes (with a small buffer so the
      // bridge is GUARANTEED at full opacity before we start
      // tearing down the old page) kick off the route change AND
      // the strip animation. The buffer is what removed the
      // residual black flash on / → next-page: the home page's
      // WebGL canvas briefly clears to black during dispose +
      // forceContextLoss, and we don't want any of that frame
      // leaking through a partially-transparent bridge.
      const handoffAt = FADE_IN_MS + ROUTE_HANDOFF_BUFFER;
      timersRef.current.push(
        window.setTimeout(() => {
          // chain-active toggles a few shell-class hooks while the
          // strip is moving (logo colour lock, etc.).
          document.documentElement.classList.add("chain-active");
          router.push(e.detail.to);
          setAnimating(true);
        }, handoffAt)
      );

      // End of the strip animation: hand off from chain-active to
      // chain-settling. The shell eases to its data-theme colour,
      // and the bridge starts fading out, revealing the NEW page's
      // gallery underneath.
      timersRef.current.push(
        window.setTimeout(() => {
          setFading(true);
          document.documentElement.classList.remove("chain-active");
          document.documentElement.classList.add("chain-settling");
        }, handoffAt + dur)
      );
      // End of the fade-out: drop chain-settling, unmount.
      timersRef.current.push(
        window.setTimeout(() => {
          setActive(false);
          setOpaque(false);
          setAnimating(false);
          setFading(false);
          document.documentElement.classList.remove("chain-settling");
        }, handoffAt + dur + FADE_OUT_MS)
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
