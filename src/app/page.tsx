import AppShell from "@/components/AppShell/AppShell";
import HomeSlider from "@/components/HomeSlider/HomeSlider";
import Socials from "@/components/Socials/Socials";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      {/* Preloader is mounted in the root layout so it also runs when
          the user lands directly on /nature, /city, /walls, etc. */}
      <main className={styles.main}>
        <AppShell
          cursorVariant="light"
          logoNoClick
          burgerClassName={styles.burger}
        >
          <HomeSlider />
          <Socials className={styles.inlineSocials} />
        </AppShell>
      </main>
    </>
  );
}
