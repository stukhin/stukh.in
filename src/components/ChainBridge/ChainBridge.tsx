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
// and React's microtasks need a frame or two of slack on top. The
// previous 80 ms buffer reduced the residual flash on / → next-page
// but didn't fully kill it; bumping to 200 gives the bridge plenty
// of headroom to be fully opaque before /home unmounts and its
// WebGL canvas releases its context.
const ROUTE_HANDOFF_BUFFER = 200;

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

  // Inject `<link rel="preload" as="image">` tags into document.head
  // for every URL the bridge can paint. This is the spec-blessed
  // resource hint for "fetch AND decode this image right now," and
  // unlike off-screen <img> tags it isn't subject to browsers
  // skipping decode for elements outside the visible viewport.
  // The earlier off-screen <img> rack was failing for slides 2-4 on
  // / specifically because slide 1 is the only one rendered live
  // by GridDistortion (which forces a decode through its WebGL
  // texture upload); 2-4 only existed in the off-screen rack and
  // browsers were lazy-decoding them. With link-preload the
  // browser eagerly fetches + decodes regardless of viewport.
  useEffect(() => {
    const sources = new Set<string>();
    Object.values(PAGE_VISUALS).forEach((v) => {
      if (v.bg) sources.add(v.bg);
    });
    for (let i = 1; i <= 4; i++) {
      sources.add(`/images/gallery/main/desktop/${i}.webp`);
    }
    const links: HTMLLinkElement[] = [];
    sources.forEach((src) => {
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = src;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => {
      links.forEach((link) => {
        if (link.parentNode) link.parentNode.removeChild(link);
      });
    };
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
      // Mount the bridge at opacity 0 (default in CSS); fade-in is
      // started below AFTER we explicitly decode the from-slide's
      // bg image, so the CSS background-image: url() on the bridge
      // slide can paint instantly on the first frame instead of
      // briefly showing the bg-color fallback.
      setActive(true);

      const startFade = () => {
        // Two RAFs to ensure the initial opaque=false state is
        // committed before flipping it on — without that the CSS
        // transition would skip its start keyframe.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setOpaque(true));
        });

        // After the fade-in completes (with a buffer so the bridge
        // is GUARANTEED at full opacity before we start tearing
        // down the old page) kick off the route change AND the
        // strip animation.
        const handoffAt = FADE_IN_MS + ROUTE_HANDOFF_BUFFER;
        timersRef.current.push(
          window.setTimeout(() => {
            document.documentElement.classList.add("chain-active");
            router.push(e.detail.to);
            setAnimating(true);
          }, handoffAt)
        );

        timersRef.current.push(
          window.setTimeout(() => {
            setFading(true);
            document.documentElement.classList.remove("chain-active");
            document.documentElement.classList.add("chain-settling");
          }, handoffAt + dur)
        );
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

      // Critical: explicitly decode the FROM-route's bg image
      // (whatever the bridge slide for that route will paint as
      // its background-image) BEFORE letting the fade-in start.
      // The user's specific clue — flash exists on home slides
      // 2/3/4 but never on slide 1 — was the smoking gun: slide 1
      // is the only one GridDistortion has ever rendered live as
      // a WebGL texture, which warmed Chrome's render-pipeline
      // image cache for that URL. Slides 2/3/4 sit only in the
      // <link rel="preload"> + off-screen <img> caches, which
      // browsers will lazy-decode when the resource isn't
      // visibly painted yet, so the bridge's first paint
      // showed only the bg-color fallback (#0d1117 dark) for a
      // frame and read as a black flash. Forcing img.decode()
      // synchronously here guarantees the URL is in the
      // rendering cache before we fade the bridge in.
      const fromVisual = PAGE_VISUALS[e.detail.from];
      const fromBg = fromVisual?.bg;
      if (fromBg && typeof Image !== "undefined") {
        const img = new Image();
        img.src = fromBg;
        img.decode().then(startFade, startFade);
      } else {
        startFade();
      }
    };

    window.addEventListener("chainNavigate", handler);
    return () => {
      window.removeEventListener("chainNavigate", handler);
      clearTimers();
      clearShellClasses();
    };
  }, [router]);

  // Build the union of every URL the bridge could ever paint as a
  // slide bg — static PAGE_VISUALS values + the four home slides
  // (PAGE_VISUALS["/"].bg flips between them as the user rotates).
  // We render these as off-screen <img> tags below, ALWAYS mounted,
  // so the browser keeps them decoded in the HTML image-decode
  // cache from app boot and a CSS background-image: url() on the
  // bridge slide can paint them on the very first frame instead of
  // briefly showing only the bg-color fallback.
  const preloadSrcs = new Set<string>();
  Object.values(PAGE_VISUALS).forEach((v) => {
    if (v.bg) preloadSrcs.add(v.bg);
  });
  for (let i = 1; i <= 4; i++) {
    preloadSrcs.add(`/images/gallery/main/desktop/${i}.webp`);
  }

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

  if (!active) {
    // Even when no chain is in flight, keep the preload rack mounted
    // so the slide bg images stay in the browser's image-decode
    // cache. Cheap (~6 invisible <img> tags).
    return (
      <div className={styles.preloadRack} aria-hidden="true">
        {Array.from(preloadSrcs).map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className={styles.preloadRack} aria-hidden="true">
        {Array.from(preloadSrcs).map((src) => (
          <img key={src} src={src} alt="" />
        ))}
      </div>
      <div className={bridgeClasses} style={style} aria-hidden="true">
      <div className={`${styles.strip} ${animating ? styles.animating : ""}`}>
        {PAGE_ORDER.map((href) => {
          const v = PAGE_VISUALS[href] || { color: "#0a0a0c" };
          return (
            <div
              key={href}
              className={styles.slide}
              style={{ backgroundColor: v.color }}
            >
              {v.bg && (
                /* Use a real <img> instead of CSS background-image:
                   url(). The img element has its own paint
                   pipeline that's less prone to a "fallback colour
                   shows for one frame while CSS decodes" race —
                   the user-reported black flash on / → next-page
                   was traced to that race for slides 2/3/4 (slide
                   1 always paints because GridDistortion already
                   warmed its decode cache via the WebGL texture
                   upload). decoding="sync" tells the browser to
                   decode on the same paint pass; loading="eager"
                   defeats lazy-load. */
                <img
                  src={v.bg}
                  alt=""
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  className={styles.slideImg}
                />
              )}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
