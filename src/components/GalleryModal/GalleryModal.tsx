"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GalleryItem } from "../GallerySlider/GallerySlider";
import styles from "./GalleryModal.module.css";

// Slower, more deliberate FLIP: a touch of ease-in at the start, slow
// growth through the middle, soft deceleration at the end. The
// backdrop blur opacity in the CSS uses the same timing so the
// frosted-glass overlay blooms in as the photo grows.
const ZOOM_IN_MS = 750;
const ZOOM_OUT_MS = 550;
const ZOOM_EASING = "cubic-bezier(0.65, 0, 0.25, 1)";

type Props = {
  open: boolean;
  category: "nature" | "city";
  item?: GalleryItem;
  index: number;
  orientation: "vertical" | "horizontal";
  /**
   * Bounding rect of the active gallery thumbnail at the moment the
   * user clicked it. Used to FLIP-morph the modal photo from the
   * grid slot into its centred position.
   */
  fromRect?: DOMRect | null;
  /**
   * Returns the active thumbnail's current rect — needed at close
   * time so the photo can morph back to whatever position the
   * thumbnail is at right now (the user might have swiped to a new
   * slide while the modal was open).
   */
  getCurrentRect?: () => DOMRect | null;
  /** Whether each orientation actually has a corresponding image
   *  on disk. The toggle hides the orientation that's missing,
   *  and the toggle group disappears entirely when only one is
   *  available. */
  hasVertical?: boolean;
  hasHorizontal?: boolean;
  onClose: () => void;
  onOrientationChange: (o: "vertical" | "horizontal") => void;
};

export default function GalleryModal({
  open,
  category,
  item,
  index,
  orientation,
  fromRect,
  getCurrentRect,
  hasVertical = true,
  hasHorizontal = true,
  onClose,
  onOrientationChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [closing, setClosing] = useState(false);
  /**
   * Aspect ratio of the loaded photo (width/height). Used as inline
   * style on .zoomWrap so the wrapper sizes to the photo's natural
   * fit-rect inside the modal instead of expanding to the image's
   * raw pixel dimensions. Without this the inline-block wrap was
   * sized to e.g. 2400×3000 and overflowed the viewport — only a
   * sliver of the photo was visible. Default 3/4 (typical vertical
   * photo) before load so first paint isn't catastrophically wrong.
   */
  const [pictureAspect, setPictureAspect] = useState<number>(3 / 4);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoomWrapRef = useRef<HTMLDivElement>(null);
  /**
   * Pending hover-zoom state, batched via requestAnimationFrame
   * so we apply at most one transform update per repaint. With a
   * raw mousemove handler the inline transform thrashed many times
   * per frame, plus the CSS transition smoothing kept chasing a
   * moving target — the two together produced visible jitter and
   * occasional sub-pixel blur. rAF batching + no transform
   * transition gives us a clean update each tick.
   */
  const pendingZoomRef = useRef({ tx: 0, ty: 0 });
  const zoomRafRef = useRef<number | null>(null);
  // Tracks whether the open-FLIP has already played for the current
  // modal session. Without this we'd run the morph twice if the
  // image happens to load between mount and the imgLoaded effect.
  const flipRanRef = useRef(false);

  // Control mounted state so we can animate in/out
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      // open just flipped to false → run the close animation, then
      // unmount once it's finished.
      const target = zoomWrapRef.current;
      const fromRectNow = getCurrentRect?.() ?? null;
      if (target && fromRectNow) {
        const tRect = target.getBoundingClientRect();
        const dx =
          fromRectNow.left + fromRectNow.width / 2 - (tRect.left + tRect.width / 2);
        const dy =
          fromRectNow.top + fromRectNow.height / 2 - (tRect.top + tRect.height / 2);
        const scale = fromRectNow.width / tRect.width;
        target.animate(
          [
            { transform: "translate(0,0) scale(1)" },
            { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          ],
          {
            duration: ZOOM_OUT_MS,
            easing: ZOOM_EASING,
            fill: "forwards",
          }
        );
      }
      setClosing(true);
      const t = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, ZOOM_OUT_MS);
      return () => clearTimeout(t);
    }
  }, [open, mounted, getCurrentRect]);

  // FLIP zoom-in: grow the photo from the thumbnail's exact rect to
  // its centred position. We try this both when the modal mounts and
  // when the image finally finishes loading — whichever happens
  // second wins, but `flipRanRef` keeps it from playing twice.
  const runFlipIn = () => {
    if (!open || closing || !fromRect) return;
    if (flipRanRef.current) return;
    const target = zoomWrapRef.current;
    if (!target) return;
    const tRect = target.getBoundingClientRect();
    if (!tRect.width || !tRect.height) return;
    flipRanRef.current = true;
    const dx =
      fromRect.left + fromRect.width / 2 - (tRect.left + tRect.width / 2);
    const dy =
      fromRect.top + fromRect.height / 2 - (tRect.top + tRect.height / 2);
    const scale = fromRect.width / tRect.width;
    target.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: "translate(0,0) scale(1)" },
      ],
      {
        duration: ZOOM_IN_MS,
        easing: ZOOM_EASING,
        fill: "forwards",
      }
    );
  };

  useLayoutEffect(() => {
    runFlipIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing, fromRect, mounted]);

  // If the picture was still decoding when the modal mounted, the
  // initial useLayoutEffect found a zero-sized rect and bailed.
  // Re-run the morph once the bytes land and the <img> takes its
  // natural size — that's what fixes the "first-time zoom jerks"
  // case the user reported.
  useEffect(() => {
    if (imgLoaded) runFlipIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgLoaded]);

  // Reset load + flip state whenever the displayed image changes
  // (index / orientation / category) and on close.
  useEffect(() => {
    setImgLoaded(false);
    flipRanRef.current = false;
  }, [index, orientation, category]);

  useEffect(() => {
    if (!open) flipRanRef.current = false;
  }, [open]);

  // Toggle the global `zoom-open` class synchronously before paint
  // so the burger / top-nav / socials hide on the same frame the
  // modal mounts. With a regular useEffect the shell elements would
  // flash for one frame above the modal.
  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("zoom-open");
    return () => {
      document.documentElement.classList.remove("zoom-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Hover-zoom: the visible picture's outer frame stays fixed at
  // its fit-to-screen size; what zooms is the <img> INSIDE the
  // frame, kept clipped by the wrapper's overflow: hidden. The
  // photo ALWAYS covers the wrapper at any cursor position — its
  // edges never poke into view. Math: at scale S the photo is S×
  // the wrapper, with (S - 1) × wrap_size of slack to slide
  // around. Cursor (cx, cy) ∈ [0..1] maps linearly to that slack:
  //   tx = -wrap_w · (S-1) · cx
  // so cursor=0 pins photo's left edge to wrap's left, cursor=1
  // pins its right edge to wrap's right, mid keeps it centred.
  const HOVER_SCALE = 1.25;
  /**
   * Hover-zoom uses the individual `scale` + `translate` CSS
   * properties (instead of a combined `transform`) so each axis
   * can carry its own transition. `scale` gets a long 0.9s
   * transition so entering / leaving the photo eases smoothly
   * from 1× to 1.25× and back; `translate` gets a short 0.2s
   * transition so cursor-tracking inside the photo follows with
   * minimal lag once the zoom-in finishes.
   */
  const flushZoom = () => {
    zoomRafRef.current = null;
    const img = imgRef.current;
    if (!img) return;
    const { tx, ty } = pendingZoomRef.current;
    img.style.scale = String(HOVER_SCALE);
    img.style.translate = `${tx}px ${ty}px`;
  };
  const onPictureMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = zoomWrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const cx = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width)
    );
    const cy = Math.max(
      0,
      Math.min(1, (e.clientY - rect.top) / rect.height)
    );
    pendingZoomRef.current.tx = -rect.width * (HOVER_SCALE - 1) * cx;
    pendingZoomRef.current.ty = -rect.height * (HOVER_SCALE - 1) * cy;
    if (zoomRafRef.current === null) {
      zoomRafRef.current = requestAnimationFrame(flushZoom);
    }
  };
  const onPictureMouseLeave = () => {
    const img = imgRef.current;
    if (!img) return;
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
    // Reset both — scale animates back over 0.9s, translate over
    // 0.2s, so the photo softly returns to its natural fit-rect
    // while the pan unwinds quickly.
    img.style.scale = "1";
    img.style.translate = "0px 0px";
  };

  if (!mounted || !item) return null;

  const pic = String(index + 1).padStart(2, "0");
  const src = `/images/gallery/${category}/${orientation}/${pic}.jpg`;
  // The orientation toggle group only renders if at least one
  // orientation has more than zero choices — and we hide each
  // individual button if its orientation isn't actually available
  // on disk. With both available we get the existing two-button
  // toggle; with only one, no toggle group at all.
  const showToggle = hasVertical && hasHorizontal;

  return (
    <div
      className={`${styles.modal} ${open && !closing ? styles.open : ""}`}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Container does NOT stopPropagation — only the picture itself
          does. That way clicking anywhere outside the visible photo
          (in the empty space around it) closes the modal. */}
      <div className={styles.container}>
        <span
          className={`${styles.placeholder} ${
            imgLoaded ? styles.placeholderHidden : ""
          }`}
          aria-hidden="true"
        >
          <span className={styles.spinner}>
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </span>
        </span>
        <div
          ref={zoomWrapRef}
          className={styles.zoomWrap}
          style={{ aspectRatio: String(pictureAspect) }}
          onMouseMove={onPictureMouseMove}
          onMouseLeave={onPictureMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            alt={item.title}
            loading="eager"
            decoding="sync"
            className={`${styles.picture} ${
              imgLoaded ? styles.pictureLoaded : ""
            }`}
            src={src}
            onLoad={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                setPictureAspect(el.naturalWidth / el.naturalHeight);
              }
              setImgLoaded(true);
            }}
            ref={(el) => {
              imgRef.current = el;
              if (el && el.complete && el.naturalWidth > 0) {
                setPictureAspect(el.naturalWidth / el.naturalHeight);
                setImgLoaded(true);
              }
            }}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (orientation === "horizontal") {
                el.src = `/images/gallery/${category}/vertical/${pic}.jpg`;
              }
            }}
          />
        </div>
      </div>
      <div
        className={styles.buttons}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.actionButtons}>
          <button
            className={`${styles.button} ${styles.close}`}
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <span className={styles.bar} />
            <span className={styles.bar} />
          </button>
        </div>
        {showToggle && (
        <div className={styles.resizeButtons}>
          <button
            className={`${styles.button} ${
              orientation === "vertical" ? styles.active : ""
            }`}
            type="button"
            onClick={() => onOrientationChange("vertical")}
            aria-label="Vertical"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="none"
            >
              <path
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19.833 3.5H8.167a2.333 2.333 0 0 0-2.334 2.333v16.334A2.333 2.333 0 0 0 8.167 24.5h11.666a2.333 2.333 0 0 0 2.334-2.333V5.833A2.333 2.333 0 0 0 19.833 3.5Z"
              />
            </svg>
          </button>
          <button
            className={`${styles.button} ${
              orientation === "horizontal" ? styles.active : ""
            }`}
            type="button"
            onClick={() => onOrientationChange("horizontal")}
            aria-label="Horizontal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              fill="none"
              style={{ transform: "rotate(90deg)" }}
            >
              <path
                stroke="#fff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19.833 3.5H8.167a2.333 2.333 0 0 0-2.334 2.333v16.334A2.333 2.333 0 0 0 8.167 24.5h11.666a2.333 2.333 0 0 0 2.334-2.333V5.833A2.333 2.333 0 0 0 19.833 3.5Z"
              />
            </svg>
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
