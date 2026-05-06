import AppShell from "@/components/AppShell/AppShell";
import HomeSlider from "@/components/HomeSlider/HomeSlider";
import Socials from "@/components/Socials/Socials";
import Preloader from "@/components/Preloader/Preloader";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <Preloader />
      <main className={styles.main}>
        <AppShell
          logoColor="#F5F9FA"
          cursorVariant="light"
          burgerBg="rgba(149, 174, 181, 0.25)"
          burgerLine="#F5F9FA"
          logoNoClick
          burgerClassName={styles.burger}
        >
          <HomeSlider />
          {/* HomeToggle (hobby/work) parked for now — see
              src/components/HomeToggle/, will land back on the page
              once the design is settled. */}
          <Socials className={styles.inlineSocials} />
        </AppShell>
      </main>
    </>
  );
}
