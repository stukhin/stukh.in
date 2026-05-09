"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import GalleryModal from "../GalleryModal/GalleryModal";
import {
  hasHorizontal,
  hasVertical,
} from "@/data/galleryManifest";
import { useVerticalPageSwipe } from "@/lib/useVerticalPageSwipe";
import styles from "./GallerySlider.module.css";

export type GalleryItem = {
  title: string;
  location: string;
  prices: { size: string; price: string }[];
};

type Props = {
  category: "nature" | "city";
  items: GalleryItem[];
};

export default function GallerySlider({ category, items }: Props) {
  // Touch-only: swipe up/down to navigate to the prev/next PAGE_ORDER
  // block. Horizontal swipes still go to the underlying Swiper.
  useVerticalPageSwipe();

  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOrientation, setModalOrientation] = useState<
    "vertical" | "horizontal"
  >("vertical");

  // Available orientations for the photo currently in the modal.
  // Drives whether the resize buttons render at all (hidden if only
  // one orientation exists) and forces the modal back to vertical
  // when the user navigates to a photo that ships only vertical.
  const availableHorizontal = hasHorizontal(category, activeIndex);
  const availableVertical = hasVertical(category, activeIndex);
  useEffect(() => {
    if (modalOrientation === "horizontal" && !availableHorizontal) {
      setModalOrientation("vertical");
    } else if (modalOrientation === "vertical" && !availableVertical) {
      setModalOrientation("horizontal");
    }
  }, [availableHorizontal, availableVertical, modalOrientation]);

  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [modalFromRect, setModalFromRect] = useState<DOMRect | null>(null);

  const swiperRef = useRef<SwiperType | null>(null);

  // Defer enabling the `.container` transform transition until the
  // first Swiper layout pass has settled. With the transition active
  // from frame 0, every slide animates from transform: identity to
  // its scale(0.53) + translateX target on mount, which read as a
  // "left side drifts in" glitch. With the transition flipped on
  // ~100ms after mount, the initial scaled positions snap into place
  // instantly AND subsequent state changes (clicking a side photo
  // → it gracefully zooms into the active frame) animate smoothly.
  const [transitionsReady, setTransitionsReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTransitionsReady(true), 120);
    return () => window.clearTimeout(t);
  }, []);

  /**
   * For each rendered Swiper slide, write a CSS variable that pulls
   * non-immediate-neighbour slides closer to the centre. Adjacent
   * slides (distance 1) keep their natural Swiper position; slide
   * pairs further out shift toward the active slide so the visual
   * gap between them halves. The shift compounds with distance
   * (2 → 1 step, 3 → 2 steps, ...) so the trailing slides ride
   * inward like a perspective. Desktop only — the CSS that reads
   * --slide-shift-x is gated on min-width: 1025px.
   */
  const updateSlideShifts = useCallback((s: SwiperType) => {
    // The shift step matches the visual margin around a non-active
    // slide on desktop: slide layout width 370px × scale 0.53 leaves
    // (370 - 196) / 2 ≈ 87px of empty space on each side. Pulling a
    // slide inward by one step closes one of those margins.
    const STEP_PX = 87;
    s.slides.forEach((slideEl, i) => {
      const slide = slideEl as HTMLElement;
      const rawDist = i - s.activeIndex;
      const ringsIn = Math.max(0, Math.abs(rawDist) - 1);
      const sign = rawDist === 0 ? 0 : rawDist > 0 ? -1 : 1;
      slide.style.setProperty(
        "--slide-shift-x",
        `${ringsIn * STEP_PX * sign}px`
      );
    });
  }, []);

  /** Drag state for the custom slider thumb (the small bar that
   *  shows where in the gallery the user currently is). Hover paints
   *  a filled disc cursor; pressing shrinks it to a smaller disc with
   *  a soft halo so the click reads. Mouse + touch are both wired
   *  through here. */
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  /** Returns the active slide's <img> rect — used by the modal so the
   * FLIP animation can morph back to whatever slide is currently
   * active when the user closes (in case they navigate while the
   * modal is open). */
  const getActiveImgRect = (): DOMRect | null => {
    const el = document
      .querySelector(".swiper-slide-active img")
      ?.getBoundingClientRect();
    return el || null;
  };

  const markLoaded = (i: number) =>
    setLoadedImages((prev) => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      return next;
    });

  // Keyboard arrows navigate slides + click in edge zones navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen) return;
      if (e.key === "ArrowLeft") swiperRef.current?.slidePrev();
      if (e.key === "ArrowRight") swiperRef.current?.slideNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  // Preload + DECODE the modal's full-size image for the active slide
  // as soon as it becomes active. Without this the modal opens, the
  // FLIP morph runs on an empty <img> (no natural dimensions yet),
  // and the photo pops in once bytes arrive — that's the visible
  // "first-zoom lag". `img.decode()` blocks until the bitmap is fully
  // decoded, so by the time the user clicks the modal mounts an
  // already-cached, already-decoded image.
  // Horizontal alt is fetched lazily — most users never flip
  // orientation, so don't double the network on every slide.
  useEffect(() => {
    const pic = String(activeIndex + 1).padStart(2, "0");
    const eager = new window.Image();
    eager.src = `/images/gallery/${category}/vertical/${pic}.jpg`;
    eager.decode?.().catch(() => {
      // Decode can reject if the URL fails or the user navigates away
      // mid-fetch; nothing to do, the modal will just fall back to its
      // own load path.
    });
  }, [activeIndex, category]);

  const total = items.length;
  const activeItem = items[activeIndex];

  /** Map an absolute clientX into a gallery index by reading the
   *  current track rect, clamping to [0, total - 1], and rounding to
   *  the nearest slide. Called from mouse + touch drag handlers and
   *  also from a plain track click (so clicking anywhere along the
   *  track jumps there immediately). */
  const setIndexFromClientX = useCallback(
    (clientX: number) => {
      const track = sliderTrackRef.current;
      if (!track || total <= 1) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      const fraction = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width)
      );
      const newIdx = Math.round(fraction * (total - 1));
      const sw = swiperRef.current;
      if (!sw) return;
      sw.slideToLoop ? sw.slideToLoop(newIdx) : sw.slideTo(newIdx);
    },
    [total]
  );

  /** Mouse drag: capture window listeners on mousedown, release on
   *  mouseup. We track the cursor position 1:1 — every mousemove
   *  re-maps the clientX to a slide index, so the photo list scrubs
   *  smoothly under the thumb as it moves. */
  const onThumbMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    const onMove = (ev: MouseEvent) => setIndexFromClientX(ev.clientX);
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /** Touch drag: same shape as the mouse path but with passive=false
   *  on touchmove so we can preventDefault and stop the page from
   *  scrolling under the finger while the user is scrubbing. */
  const onThumbTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length !== 1) return;
    setDragging(true);
    const onMove = (ev: TouchEvent) => {
      ev.preventDefault();
      setIndexFromClientX(ev.touches[0].clientX);
    };
    const onEnd = () => {
      setDragging(false);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
  };

  /** Click on the track itself (not the thumb) — jump to that
   *  position. Mousedown on the thumb stops propagation, so this
   *  only fires for clicks on the bare track. */
  const onTrackClick = (e: ReactMouseEvent) => {
    setIndexFromClientX(e.clientX);
  };

  const picIndex = (i: number) => String(i + 1).padStart(2, "0");
  const verticalSrc = (i: number) =>
    `/images/gallery/${category}/vertical/${picIndex(i)}.jpg`;

  /* Swiper's loop needs enough base slides to populate the side previews
     on wide viewports (it has trouble cloning when slidesPerView is auto
     and the slide count is small). For short galleries (e.g. city has 7)
     we render the array a few times so loop has plenty of material to
     work with. The active index is normalised back to the original range
     before pulling title/location/src. */
  const MIN_SLIDES = 14;
  const repeats =
    items.length === 0 ? 1 : Math.max(1, Math.ceil(MIN_SLIDES / items.length));
  const renderedSlides =
    repeats === 1
      ? items
      : Array.from({ length: repeats }, () => items).flat();

  return (
    <div
      className={`${styles.gallerySlider} ${styles[category]} ${
        transitionsReady ? styles.transitionsReady : ""
      }`}
    >
      {/* Central picture background (shadowed rectangle) + frame overlay */}
      <div className={styles.pictureBg} />
      <div className={styles.frame} />

      <Swiper
        modules={[Keyboard, Mousewheel]}
        className={styles.swiper}
        slidesPerView="auto"
        centeredSlides
        spaceBetween={0}
        keyboard
        loop
        mousewheel={{ forceToAxis: true, sensitivity: 0.6 }}
        speed={650}
        onSwiper={(s) => {
          swiperRef.current = s;
          updateSlideShifts(s);
        }}
        onSlideChange={(s) => {
          setActiveIndex(s.realIndex % items.length);
          updateSlideShifts(s);
        }}
      >
        {renderedSlides.map((item, i) => {
          const realIdx = i % items.length;
          const isActive = realIdx === activeIndex;
          return (
            <SwiperSlide key={i} className={styles.slide}>
              <div className={styles.container}>
                <div className={styles.wrapper}>
                  <button
                    type="button"
                    className={styles.pictureButton}
                    onClick={async () => {
                      if (!isActive) {
                        swiperRef.current?.slideToLoop?.(i) ??
                          swiperRef.current?.slideTo(i);
                        return;
                      }
                      // Make sure the picture is fully decoded before
                      // opening the modal. The proactive preload on
                      // slide change usually has it ready, but if the
                      // user clicks faster than decode finishes the
                      // FLIP morph would run on a 0×0 <img> and pop
                      // the photo in without animation.
                      const url = verticalSrc(realIdx);
                      const probe = new window.Image();
                      probe.src = url;
                      if (!(probe.complete && probe.naturalWidth > 0)) {
                        try {
                          await probe.decode();
                        } catch {
                          // Decode rejected (rare) — fall through and
                          // let the modal handle its own load state.
                        }
                      }
                      setModalFromRect(getActiveImgRect());
                      setModalOpen(true);
                    }}
                    aria-label={`Open ${item.title}`}
                    data-cursor={isActive ? "picture" : undefined}
                  >
                    <span
                      className={`${styles.placeholder} ${
                        loadedImages.has(realIdx) ? styles.placeholderHidden : ""
                      }`}
                      aria-hidden="true"
                    />
                    <img
                      src={verticalSrc(realIdx)}
                      alt={item.title}
                      className={`${styles.picture} ${
                        loadedImages.has(realIdx) ? styles.pictureLoaded : ""
                      }`}
                      loading="eager"
                      decoding="async"
                      draggable={false}
                      onLoad={() => markLoaded(realIdx)}
                      ref={(el) => {
                        if (el && el.complete && el.naturalWidth > 0) {
                          markLoaded(realIdx);
                        }
                      }}
                    />
                  </button>
                </div>
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>

      {/* Active text overlay — separate from slides, fades in on change.
          Hidden while the modal is open so it doesn't peek through. */}
      <div
        className={`${styles.activeText} ${styles[`text_${category}`]} ${
          modalOpen ? styles.hidden : ""
        }`}
        key={activeIndex}
      >
        <h3 className={styles.title}>{activeItem.title}</h3>
        <p className={styles.location}>{activeItem.location}</p>
      </div>

      {/* Edge click zones for prev/next navigation (with custom arrow cursor) */}
      <button
        type="button"
        className={`${styles.navZone} ${styles.navPrev}`}
        onClick={() => swiperRef.current?.slidePrev()}
        aria-label="Previous photo"
        data-cursor="arrow-left"
      />
      <button
        type="button"
        className={`${styles.navZone} ${styles.navNext}`}
        onClick={() => swiperRef.current?.slideNext()}
        aria-label="Next photo"
        data-cursor="arrow-right"
      />

      {/* Custom slider: a thin track with a short bar thumb on top.
          Replaced the native <input type="range"> so we can paint a
          grab / grabbing custom cursor on hover / drag (the native
          input has the thumb scoped to a pseudo-element and the
          custom Cursor component can't read hovers on those). */}
      <div
        ref={sliderTrackRef}
        className={`${styles.slider} ${styles[`slider_${category}`]} ${
          modalOpen ? styles.hidden : ""
        }`}
        onClick={onTrackClick}
        role="slider"
        aria-label="Gallery position"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, total - 1)}
        aria-valuenow={activeIndex}
      >
        <div className={styles.sliderTrack} />
        <div
          className={`${styles.sliderThumb} ${
            dragging ? styles.sliderThumbDragging : ""
          }`}
          style={{
            left:
              total > 1 ? `${(activeIndex / (total - 1)) * 100}%` : `0%`,
          }}
          data-cursor={dragging ? "grabbing" : "grab"}
          onMouseDown={onThumbMouseDown}
          onTouchStart={onThumbTouchStart}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <GalleryModal
        open={modalOpen}
        category={category}
        item={activeItem}
        index={activeIndex}
        orientation={modalOrientation}
        hasVertical={availableVertical}
        hasHorizontal={availableHorizontal}
        fromRect={modalFromRect}
        getCurrentRect={getActiveImgRect}
        onClose={() => setModalOpen(false)}
        onOrientationChange={setModalOrientation}
      />
    </div>
  );
}
