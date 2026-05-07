import AppShell from "@/components/AppShell/AppShell";
import BlogMap from "@/components/BlogMap/BlogMap";
import styles from "./blog.module.css";

export const metadata = {
  title: "Blog — Sasha Stukhin",
};

/**
 * /blog — the light page in the chain (home dark → nature dark →
 * city light → walls dark → blog light, alternating). The world
 * map fills the page as a parallax background; the small header at
 * the top of the viewport states what it is. Future iterations will
 * wire each visited country to a hover preview and an optional click
 * through to /walls filtered by location.
 */
export default function BlogPage() {
  return (
    <div className={styles.page}>
      {/* Map sits underneath everything — it owns the whole viewport
          and animates with the cursor. */}
      <BlogMap />
      <AppShell
        theme="light"
        cursorVariant="dark"
        burgerBg="rgba(20, 20, 20, 0.08)"
        burgerLine="#1a1a1a"
      >
        <header className={styles.head}>
          <h1 className={styles.title}>where i&apos;ve been</h1>
          <p className={styles.subtitle}>
            countries i&apos;ve photographed in. interactive previews
            and per-country stories are coming.
          </p>
        </header>
      </AppShell>
    </div>
  );
}
