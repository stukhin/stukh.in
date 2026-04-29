import AppShell from "@/components/AppShell/AppShell";
import GallerySlider from "@/components/GallerySlider/GallerySlider";
import LightRays from "@/components/LightRays/LightRays";
import natureData from "@/data/nature.json";
import styles from "./nature.module.css";

export const metadata = {
  title: "Nature — Sasha Stukhin",
};

// We only have 21 images in /public/images/gallery/nature/. The data file
// carries 25 entries for future shots — trim to the photos we can actually
// render so Swiper's loop clones don't fetch missing files.
const items = natureData.slice(0, 21);

export default function NaturePage() {
  return (
    <div className={styles.nature}>
      <LightRays
        raysOrigin="top-center"
        raysColor="#a8c8d6"
        raysSpeed={0.5}
        lightSpread={1.4}
        rayLength={1.6}
        fadeDistance={0.85}
        saturation={0.55}
        followMouse
        mouseInfluence={0.08}
        noiseAmount={0.05}
        distortion={0.02}
      />
      <AppShell
        logoColor="#fff"
        cursorVariant="light"
        burgerBg="#3C3C3C"
        burgerLine="#FFFFFF"
      >
        <GallerySlider category="nature" items={items} />
      </AppShell>
    </div>
  );
}
