"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_ORDER } from "@/lib/pageOrder";
import { PAGE_VISUALS, getRouteBg } from "@/lib/pageVisuals";
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

      // prefers-reduced-motion: skip the slide animation entirely
      // and hand off to plain router.push. The visual that the chain
      // bridge paints is precisely the sustained translateY whoosh
      // that vestibular-sensitive users opt out of — better to give
      // them a clean instant route swap.
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        router.push(e.detail.to);
        return;
      }

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
      // <link rel="preload"> cache, which browsers will lazy-
      // decode when the resource isn't visibly painted yet, so
      // the bridge's first paint showed only the bg-color
      // fallback (#0d1117 dark) for a frame and read as a black
      // flash. Forcing img.decode() synchronously here guarantees
      // the URL is in the rendering cache before we fade the
      // bridge in. Use getRouteBg so the live home slide (2/3/4
      // if the user rotated past slide 1) decodes — not the
      // static default.
      const fromBg = getRouteBg(e.detail.from);
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

  // Off-screen <img> rack used to live here as a third preload
  // mechanism on top of the <link rel="preload"> useEffect above and
  // the Preloader component. Dropped: link-preload is the spec-
  // blessed path and the explicit img.decode() in `startFade` is
  // what actually guarantees the from-route bg is in the render
  // cache before the fade-in. The rack was redundant work.
  if (!active) return null;

  return (
    <>
      <div className={bridgeClasses} style={style} aria-hidden="true">
      <div className={`${styles.strip} ${animating ? styles.animating : ""}`}>
        {PAGE_ORDER.map((href) => {
          const v = PAGE_VISUALS[href] || { color: "#0a0a0c" };
          // Routes that render a skeleton instead of a bg photo on
          // their bridge slide. The skeleton is filled (not bordered)
          // semi-translucent rectangles in the same shape as the
          // destination page's real elements, so the user sees a
          // structural "page is loading here" hint WHILE the strip
          // is sliding rather than only after the bridge fades out.
          const skeleton =
            href === "/nature" || href === "/city"
              ? "gallery"
              : href === "/walls"
              ? "walls"
              : null;
          // Bg photo always renders when the route has one — skeleton
          // (when present) sits ON TOP as a barely-translucent
          // overlay. The user explicitly wanted to keep the
          // background textures (bg_nature / bg_city) visible during
          // the slide; the skeleton just marks where elements will
          // land without dominating the visual. Read via getRouteBg
          // so the live home slide (HomeSlider rotates between four)
          // paints, not the static default.
          const liveBg = getRouteBg(href);
          const showBgImage = Boolean(liveBg);
          // Skeleton fill: very low alpha (~5 %) per user spec —
          // "еле-еле, чуть-чуть виднелись". Dark routes get a
          // white-translucent veil; cream /city gets dark.
          const skeletonStyle =
            href === "/city"
              ? ({
                  "--skeleton-fill": "rgba(0, 0, 0, 0.05)",
                } as CSSProperties)
              : ({
                  "--skeleton-fill": "rgba(255, 255, 255, 0.05)",
                } as CSSProperties);

          return (
            <div
              key={href}
              className={styles.slide}
              style={{
                backgroundColor: v.color,
                ...(skeleton ? skeletonStyle : {}),
              }}
            >
              {showBgImage && (
                /* Real <img> rather than CSS background-image:url()
                   so the image element handles decode + paint. */
                <img
                  src={liveBg!}
                  alt=""
                  loading="eager"
                  decoding="sync"
                  fetchPriority="high"
                  className={styles.slideImg}
                />
              )}

              {skeleton === "gallery" && (
                <div className={styles.skeletonGallery}>
                  {/* Centre frame + 3 thumbs on each side, mirroring
                      Swiper's coverflow-ish row of side previews on
                      a wide desktop. */}
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="left"
                    data-distance="3"
                  />
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="left"
                    data-distance="2"
                  />
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="left"
                    data-distance="1"
                  />
                  <span className={styles.skeletonGalleryFrame} />
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="right"
                    data-distance="1"
                  />
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="right"
                    data-distance="2"
                  />
                  <span
                    className={styles.skeletonGallerySide}
                    data-side="right"
                    data-distance="3"
                  />
                  <span className={styles.skeletonGalleryText} />
                  <span className={styles.skeletonGallerySlider} />
                </div>
              )}

              {skeleton === "walls" && (
                <div className={styles.skeletonWalls}>
                  <div className={styles.skeletonWallsFilters}>
                    <span className={styles.skeletonWallsPill} />
                    <span className={styles.skeletonWallsPill} />
                  </div>
                  <div className={styles.skeletonWallsGrid}>
                    {/* Render 10 cards so the wide-desktop 5-column
                        layout fills two full rows; narrower
                        breakpoints (4/3/1 col) just wrap to more
                        rows naturally. */}
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span
                        key={i}
                        className={styles.skeletonWallsCard}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
