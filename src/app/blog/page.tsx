import AppShell from "@/components/AppShell/AppShell";
import BlogMap from "@/components/BlogMap/BlogMap";
import styles from "./blog.module.css";

export const metadata = {
  title: "Blog — Sasha Stukhin",
};

/**
 * /blog — the light page in the chain (home dark → nature dark →
 * city light → walls dark → blog light, alternating). For now it's
 * a placeholder world map: visited countries plotted as dots, with
 * hover labels. Future iterations will turn each dot into a small
 * photo + recommendation card; the "under construction" stamp on
 * the map makes the in-progress state explicit.
 */
export default function BlogPage() {
  return (
    <div className={styles.page}>
      <AppShell
        theme="light"
        cursorVariant="dark"
        burgerBg="rgba(20, 20, 20, 0.08)"
        burgerLine="#1a1a1a"
      >
        <main className={styles.inner}>
          <header className={styles.head}>
            <h1 className={styles.title}>where i&apos;ve been</h1>
            <p className={styles.subtitle}>
              dots mark places i&apos;ve photographed. hover to see the
              country — interactive previews are coming.
            </p>
          </header>

          <BlogMap />
        </main>
      </AppShell>
    </div>
  );
}
