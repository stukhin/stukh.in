import AppShell from "@/components/AppShell/AppShell";
import BlogMap from "@/components/BlogMap/BlogMap";
import styles from "./blog.module.css";

export const metadata = {
  title: "Blog — Sasha Stukhin",
};

/**
 * /blog — the light page in the chain (home dark → nature dark →
 * city light → walls dark → blog light, alternating). The whole
 * page is the world map: hover a visited country for a quick
 * preview plate, click for the full story modal.
 *
 * Title and subtitle are gone on purpose — until the map has real
 * stories to tell, the only header is the centred "under
 * construction" stamp inside BlogMap.
 */
export default function BlogPage() {
  return (
    <div className={styles.page}>
      <BlogMap />
      <AppShell
        theme="light"
        cursorVariant="dark"
        burgerBg="rgba(20, 20, 20, 0.08)"
        burgerLine="#1a1a1a"
      >
        <></>
      </AppShell>
    </div>
  );
}
