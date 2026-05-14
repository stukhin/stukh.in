import AppShell from "@/components/AppShell/AppShell";
import BlogMapClient from "./BlogMapClient";
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
      <BlogMapClient />
      <AppShell theme="light" cursorVariant="dark">
        <></>
      </AppShell>
    </div>
  );
}
