import AppShell from "@/components/AppShell/AppShell";
import GallerySlider from "@/components/GallerySlider/GallerySlider";
import cityData from "@/data/city.json";
import styles from "./city.module.css";

export const metadata = {
  title: "City — Sasha Stukhin",
};

export default function CityPage() {
  return (
    <div className={styles.city}>
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
