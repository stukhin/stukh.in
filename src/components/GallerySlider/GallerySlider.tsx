"use client";

import { useEffect, useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Mousewheel } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import "swiper/css";
import GalleryModal from "../GalleryModal/GalleryModal";
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
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalOrientation, setModalOrientation] = useState<
    "vertical" | "horizontal"
  >("vertical");

  const swiperRef = useRef<SwiperType | null>(null);

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

  const total = items.length;
  const activeItem = items[activeIndex];

  const picIndex = (i: number) => String(i + 1).padStart(2, "0");
  const verticalSrc = (i: number) =>
    `/images/gallery/${category}/vertical/${picIndex(i)}.jpg`;

  return (
    <div className={`${styles.gallerySlider} ${styles[category]}`}>
      {/* Central picture background (shadowed rectangle) + frame overlay */}
      <div className={styles.pictureBg} />
      <div className={styles.frame} />

      <Swiper
        modules={[Keyboard, Mousewheel]}
        className={styles.swiper}
        slidesPerView="auto"
        centeredSlides
        spaceBetween={0}
        grabCursor
        keyboard
        loop
        mousewheel={{ forceToAxis: true, sensitivity: 0.6 }}
        speed={650}
        onSwiper={(s) => {
          swiperRef.current = s;
        }}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
      >
        {items.map((item, i) => {
          const isActive = i === activeIndex;
          return (
            <SwiperSlide key={i} className={styles.slide}>
              <div className={styles.container}>
                <div className={styles.wrapper}>
                  <button
                    type="button"
                    className={styles.pictureButton}
                    onClick={() => {
                      if (isActive) {
                        setModalOpen(true);
                      } else {
                        swiperRef.current?.slideToLoop?.(i) ??
                          swiperRef.current?.slideTo(i);
                      }
                    }}
                    aria-label={`Open ${item.title}`}
                    data-cursor={isActive ? "picture" : undefined}
                  >
                    <img
                      src={verticalSrc(i)}
                      alt={item.title}
                      className={styles.picture}
                      loading={isActive ? "eager" : "lazy"}
                      draggable={false}
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

      <input
        className={`${styles.input} ${styles[category]} ${
          modalOpen ? styles.hidden : ""
        }`}
        type="range"
        min={0}
        max={total - 1}
        value={activeIndex}
        onChange={(e) => {
          const v = Number(e.target.value);
          swiperRef.current?.slideToLoop?.(v) ?? swiperRef.current?.slideTo(v);
        }}
        aria-label="Gallery position"
      />

      <GalleryModal
        open={modalOpen}
        category={category}
        item={activeItem}
        index={activeIndex}
        orientation={modalOrientation}
        onClose={() => setModalOpen(false)}
        onOrientationChange={setModalOrientation}
      />
    </div>
  );
}
