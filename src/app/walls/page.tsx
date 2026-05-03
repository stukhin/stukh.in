import AppShell from "@/components/AppShell/AppShell";
import Grainient from "@/components/Grainient/Grainient";
import ScrollProgress from "@/components/ScrollProgress/ScrollProgress";
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
      <div className={styles.bg}>
        <Grainient
          color1="#2c2c2c"
          color2="#403f41"
          color3="#5f5e5e"
          timeSpeed={1.3}
          colorBalance={-0.05}
          warpStrength={1.0}
          warpFrequency={5.0}
          warpSpeed={2.0}
          warpAmplitude={50.0}
          blendAngle={0.0}
          blendSoftness={0.05}
          rotationAmount={500.0}
          noiseScale={2.05}
          grainAmount={0.1}
          grainScale={2.0}
          grainAnimated={false}
          contrast={1.5}
          gamma={1.0}
          saturation={1.0}
          centerX={0.0}
          centerY={0.0}
          zoom={0.9}
        />
      </div>
      <AppShell
        theme="dark"
        logoColor="#F5F9FA"
        cursorVariant="light"
        burgerBg="rgba(149, 174, 181, 0.25)"
        burgerLine="#F5F9FA"
      >
        <main className={styles.main}>
          <WallsGallery items={wallsData as Wallpaper[]} />
        </main>
      </AppShell>
      <ScrollProgress />
    </div>
  );
}
