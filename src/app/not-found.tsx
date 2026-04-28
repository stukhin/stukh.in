import Link from "next/link";
import AppShell from "@/components/AppShell/AppShell";
import styles from "./not-found.module.css";

export const metadata = {
  title: "404 — Sasha Stukhin",
};

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <AppShell
        logoColor="#F5F9FA"
        cursorVariant="light"
        burgerBg="rgba(149, 174, 181, 0.25)"
        burgerLine="#F5F9FA"
      >
        <main className={styles.inner}>
          <h1 className={styles.code}>404</h1>
          <p className={styles.text}>This page could not be found.</p>
          <Link href="/" className={styles.back}>
            return to main
            <span className={styles.underline} />
          </Link>
        </main>
      </AppShell>
    </div>
  );
}
