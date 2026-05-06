import type { Metadata } from "next";
import styles from "./system.module.css";

/**
 * Internal design-system / styleguide reference page.
 *
 * - Lives at /system. Direct-URL access only, NOT linked from any
 *   shell element on the public site.
 * - Tagged noindex / nofollow / nosnippet so search engines skip
 *   it (also blocked at the robots.txt layer in public/robots.txt).
 * - Updated by hand as the system evolves. Treat this file as the
 *   canonical reference for the visual tokens currently in use.
 */
export const metadata: Metadata = {
  title: "System — Sasha Stukhin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
    },
  },
};

const TYPOGRAPHY = [
  { name: "Logo wordmark", family: "Rubik", size: "112×90px (SVG)", weight: "—", note: "Vector, mix-blend-mode: difference" },
  { name: "Top nav link", family: "Rubik / Inter", size: "18px / 1", weight: "300", note: "TopNav.module.css .link" },
  { name: "Walls card title", family: "Rubik", size: "18px", weight: "300", note: ".cardTitle" },
  { name: "Walls card meta / story", family: "Rubik", size: "12px", weight: "300", note: ".meta · .story" },
  { name: "Walls card specs", family: "Rubik", size: "10px / 0.08em uppercase", weight: "300", note: ".specs" },
  { name: "Walls filter label", family: "Inter / Rubik", size: "16px / 0.02em", weight: "200", note: ".catBtn (lowercase)" },
  { name: "Modal placeholder copy", family: "Rubik", size: "12px", weight: "300", note: "Placeholder, popup footer" },
];

const COLORS: { name: string; token: string; hex: string; note: string }[] = [
  { name: "Page bg — home", token: "—", hex: "#0d1117", note: "GitHub-ish ink, behind HomeSlider" },
  { name: "Page bg — walls / blog / trips", token: "—", hex: "#0a0a0c", note: "Near-black, with Grainient on /walls" },
  { name: "Nature canvas", token: "—", hex: "#151616", note: "behind bg_nature.webp" },
  { name: "City fallback", token: "—", hex: "#3a3a3a", note: "behind bg_city.webp (light page)" },
  { name: "Foreground — strong", token: "--shell-fg-strong", hex: "auto / #fff in popup", note: "Auto-themed; popup forces white" },
  { name: "Foreground — soft", token: "--shell-fg-soft", hex: "auto / rgba(255,255,255,.55)", note: "Hairlines, idle underlines" },
  { name: "Burger frosted-glass fill", token: "—", hex: "rgba(0,0,0,0.32)", note: "+ blur(14px) + 1px white-18% outline" },
  { name: "HomeToggle pill outline", token: "—", hex: "#ffffff (3px)", note: "Frames the whole toggle as one block" },
  { name: "ScrollProgress fill", token: "—", hex: "rgba(255,255,255,0.7)", note: "Walls bottom track" },
];

const SPACING = [
  { name: "Logo offset (desktop)", value: "top:66 left:66" },
  { name: "Burger offset (desktop hidden)", value: "top:40 right:40 — only mobile" },
  { name: "Burger offset (tablet)", value: "top:65 right:65" },
  { name: "TopNav anchor (desktop)", value: "bottom:65 right:67" },
  { name: "Walls grid gutter", value: "20px / 16px / 10px (desktop / tablet / mobile)" },
  { name: "Walls page padding (desktop)", value: "200px 0 96px" },
  { name: "Walls page padding (mobile)", value: "170px 16px 80px" },
  { name: "Card hover info (top-left)", value: "top:16 left:16 right:16" },
  { name: "Card specs (bottom-left)", value: "bottom:14 left:16" },
];

const BREAKPOINTS = [
  { name: "Mobile", range: "≤ 597px", note: "2 walls cols, sidebar inline horizontal scroll" },
  { name: "Tablet", range: "598 – 999px", note: "3 walls cols, sidebar inline" },
  { name: "Small desktop", range: "1000 – 1499px", note: "4 walls cols, sidebar inline" },
  { name: "Large desktop", range: "≥ 1500px", note: "auto-fill cols, sidebar fixed-left" },
];

const MOTION = [
  { name: "Per-page slide", value: "1.05s cubic-bezier(0.65,0,0.35,1)" },
  { name: "ChainBridge hop", value: "560/720ms — first ease-in / mid linear / last ease-out" },
  { name: "Walls zoom FLIP", value: "750ms in / 550ms out, cubic-bezier(0.65,0,0.25,1)" },
  { name: "Modal backdrop fade", value: "0.75s open / 0.55s close" },
  { name: "Home slide autoplay", value: "7s linear progress fill" },
  { name: "Home reveal (first visit)", value: "2.5s easeInOutQuad (B&W → colour)" },
];

const COMPONENTS = [
  { path: "components/Logo", purpose: "SVG wordmark, mix-blend difference, view-transition site-logo" },
  { path: "components/Burger", purpose: "Mobile-only frosted pill, opens MenuPopup" },
  { path: "components/MenuPopup", purpose: "Full-screen mobile menu (frosted glass, dark surface)" },
  { path: "components/Menu", purpose: "Inner nav list (vertical / column), used by popup" },
  { path: "components/TopNav", purpose: "Desktop bottom-right nav, mix-blend difference" },
  { path: "components/HomeSlider", purpose: "GridDistortion-driven hero, 7s autoplay + progress dots" },
  { path: "components/HomeToggle", purpose: "Hobby/work pill (currently parked off-page)" },
  { path: "components/Socials", purpose: "tg / inst icons, mask-image themed via shell-fg-strong" },
  { path: "components/WallsGallery", purpose: "42-card grid + tone/category filters + zoom modal" },
  { path: "components/GallerySlider", purpose: "/nature & /city horizontal Swiper + zoom modal" },
  { path: "components/GalleryModal", purpose: "Full-screen photo zoom with FLIP morph" },
  { path: "components/ChainBridge", purpose: "Multi-step page transition overlay" },
  { path: "components/Grainient", purpose: "ogl shader bg used on /walls" },
  { path: "components/GridDistortion", purpose: "three.js mouse-warp on home hero" },
  { path: "components/LightRays", purpose: "ogl light-rays bg on /nature & /city" },
  { path: "components/EdgeNav", purpose: "Top/bottom click zones for adjacent page nav" },
  { path: "components/Cursor", purpose: "Custom ring/dot/arrow/picture/magnifier cursor" },
  { path: "components/ScrollProgress", purpose: "Bottom-of-viewport scroll indicator (walls)" },
  { path: "components/Preloader", purpose: "First-visit loader (sessionStorage gate)" },
  { path: "components/Parallax", purpose: "Reusable parallax wrapper" },
  { path: "components/Prints", purpose: "Order page print-grid" },
  { path: "components/OrderLink / OrderMenu / OrderSection", purpose: "/order page sub-bits" },
];

export default function SystemPage() {
  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.h1}>stukh.in design system</h1>
        <p className={styles.lede}>
          Internal reference for the visual tokens, components, and motion
          currently shipping on the public site. Not linked from anywhere on
          the live site, blocked from search engines via robots metadata.
          Update this page by hand as things shift.
        </p>
      </header>

      <Section title="Typography">
        <Table
          cols={["Style", "Family", "Size", "Weight", "Note"]}
          rows={TYPOGRAPHY.map((t) => [t.name, t.family, t.size, t.weight, t.note])}
        />
      </Section>

      <Section title="Colour">
        <div className={styles.swatches}>
          {COLORS.map((c) => (
            <div key={c.name} className={styles.swatch}>
              <div
                className={styles.swatchChip}
                style={{ background: c.hex.startsWith("#") ? c.hex : "transparent" }}
              />
              <div className={styles.swatchMeta}>
                <div className={styles.swatchName}>{c.name}</div>
                <div className={styles.swatchHex}>{c.hex}</div>
                {c.token !== "—" && (
                  <div className={styles.swatchToken}>{c.token}</div>
                )}
                <div className={styles.swatchNote}>{c.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Spacing & layout">
        <Table
          cols={["Anchor", "Value"]}
          rows={SPACING.map((s) => [s.name, s.value])}
        />
      </Section>

      <Section title="Breakpoints">
        <Table
          cols={["Tier", "Range", "Behaviour"]}
          rows={BREAKPOINTS.map((b) => [b.name, b.range, b.note])}
        />
      </Section>

      <Section title="Motion">
        <Table
          cols={["Surface", "Timing"]}
          rows={MOTION.map((m) => [m.name, m.value])}
        />
      </Section>

      <Section title="Components">
        <Table
          cols={["Path", "Purpose"]}
          rows={COMPONENTS.map((c) => [c.path, c.purpose])}
        />
      </Section>

      <footer className={styles.footer}>
        Built with Next.js {`16.x`} · App Router · CSS Modules · ogl + three.
        Hosted on the same git → main branch as the public site.
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
