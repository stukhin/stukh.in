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
  onClose,
  onOrientationChange,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [closing, setClosing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
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
      const target = imgRef.current;
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
    const target = imgRef.current;
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

  if (!mounted || !item) return null;

  const pic = String(index + 1).padStart(2, "0");
  const src = `/images/gallery/${category}/${orientation}/${pic}.jpg`;

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
        <img
          alt={item.title}
          loading="eager"
          decoding="sync"
          className={`${styles.picture} ${
            imgLoaded ? styles.pictureLoaded : ""
          }`}
          src={src}
          onClick={(e) => e.stopPropagation()}
          onLoad={() => setImgLoaded(true)}
          ref={(el) => {
            imgRef.current = el;
            if (el && el.complete && el.naturalWidth > 0) {
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
      </div>
    </div>
  );
}
