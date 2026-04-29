import AppShell from "@/components/AppShell/AppShell";
import GallerySlider from "@/components/GallerySlider/GallerySlider";
import LightRays from "@/components/LightRays/LightRays";
import cityData from "@/data/city.json";
import styles from "./city.module.css";

export const metadata = {
  title: "City — Sasha Stukhin",
};

export default function CityPage() {
  return (
    <div className={styles.city}>
      <LightRays
        raysOrigin="top-center"
        raysColor="#f4f4f4"
        raysSpeed={0.5}
        lightSpread={1.4}
        rayLength={1.6}
        fadeDistance={0.85}
        saturation={0.15}
        followMouse
        mouseInfluence={0.08}
        noiseAmount={0.05}
        distortion={0.02}
      />
      <AppShell
        logoColor="#000"
        cursorVariant="dark"
        burgerBg="#3C3C3C"
        burgerLine="#F5F9FA"
      >
        <GallerySlider category="city" items={cityData} />
      </AppShell>
    </div>
  );
}
