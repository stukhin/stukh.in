import AppShell from "@/components/AppShell/AppShell";
import Grainient from "@/components/Grainient/Grainient";
import BlogMapClient from "./BlogMapClient";
import styles from "./blog.module.css";

export const metadata = {
  title: "Blog — Sasha Stukhin",
};

/**
 * /blog — was the cream-paper page in the strip; now a textured
 * Grainient surface in cool monochrome grays so the map (dark
 * silhouettes + terracotta hover) sits on a surface that feels
 * alive rather than flat. Mirror of the /walls Grainient pattern.
 *
 * Theme stays `light` (dark text / icons) — gray mid-tone still
 * carries dark foreground better than light. Country panel keeps
 * its cream surface; the blur backdrop pulls a faint gray tint
 * through, which reads as a "paper card floating over a gray
 * surface."
 */
export default function BlogPage() {
  return (
    <div className={styles.page}>
      <div className={styles.bg}>
        <Grainient
          color1="#c5c5c5"
          color2="#727272"
          color3="#717171"
          timeSpeed={1.1}
          colorBalance={-0.07}
          warpStrength={0.55}
          warpFrequency={6.9}
          warpSpeed={1.1}
          warpAmplitude={43}
          blendAngle={-81}
          blendSoftness={0.05}
          rotationAmount={500.0}
          noiseScale={2.0}
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
      <BlogMapClient />
      <AppShell theme="light" cursorVariant="dark">
        <></>
      </AppShell>
    </div>
  );
}
