import AppShell from "@/components/AppShell/AppShell";
import WallsGallery, {
  type Wallpaper,
} from "@/components/WallsGallery/WallsGallery";
import wallsData from "@/data/walls.json";
import styles from "./walls.module.css";

export const metadata = {
  title: "Walls — Sasha Stukhin",
};

export default function WallsPage() {
  return (
    <div className={styles.wrap}>
      <AppShell
        logoColor="#F5F9FA"
        cursorVariant="light"
        burgerBg="rgba(149, 174, 181, 0.25)"
        burgerLine="#F5F9FA"
      >
        <main className={styles.main}>
          <WallsGallery items={wallsData as Wallpaper[]} />
        </main>
      </AppShell>
    </div>
  );
}
