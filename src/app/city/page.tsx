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
        raysOrigin="top-left"
        raysColor="#cccfd4"
        raysSpeed={0.45}
        lightSpread={1.6}
        rayLength={1.8}
        fadeDistance={0.95}
        saturation={0.35}
        followMouse
        mouseInfluence={0.06}
        noiseAmount={0.04}
        distortion={0.01}
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
