import type { Metadata, Viewport } from "next";
import { Inter, Rubik } from "next/font/google";
import ChainBridge from "@/components/ChainBridge/ChainBridge";
import ClickSpark from "@/components/ClickSpark/ClickSpark";
import Preloader from "@/components/Preloader/Preloader";
import { ROOT_BG_SCRIPT } from "@/lib/pageVisuals";
import "./globals.css";

// Self-hosted by next/font: no render-blocking request to Google,
// CSS references the families through these variables.
const rubik = Rubik({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400"],
  variable: "--font-rubik",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["200", "300"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sasha Stukhin — Photography",
  description: "Landscape photography from all around the world",
  openGraph: {
    title: "Sasha Stukhin — Photography",
    description: "Landscape photography from all around the world",
  },
  icons: { icon: "/favicon.ico" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays on (a11y); page-strip swipes already stand down
  // while zoomed (pageNavBlocked checks visualViewport.scale).
};

// The loader sheet is in every route's server HTML and only lifts
// after hydration. Hide it before first paint when this tab already
// saw the intro (Preloader's sessionStorage key) or JS is off.
const PRELOADER_GATE = `try{if(sessionStorage.getItem("stukhin.home.intro")==="1")document.documentElement.classList.add("intro-seen")}catch(e){}`;
const PRELOADER_HIDE = "html.intro-seen [data-preloader]{display:none}";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${rubik.variable} ${inter.variable}`}
      // PRELOADER_GATE adds a class before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: PRELOADER_GATE + ROOT_BG_SCRIPT }}
        />
        <style>{PRELOADER_HIDE}</style>
        <noscript>
          <style>{"[data-preloader]{display:none}"}</style>
        </noscript>
      </head>
      <body>
        {/* Preloader is mounted at the layout level so it gates the
            first render of *any* entry route (not just /), but
            self-suppresses via sessionStorage on subsequent client-
            side navigation in the same tab. */}
        <Preloader />
        {children}
        <ChainBridge />
        {/* Click-spark overlay — fires only on clicks that lead to
            a new page (any `<a href>` to a same-tab destination, or
            EdgeNav buttons via `data-spark="nav"`). Sits at z:100,
            below the custom cursor (z:200). */}
        <ClickSpark />
      </body>
    </html>
  );
}
