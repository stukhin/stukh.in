import type { Metadata, Viewport } from "next";
import { Inter, Rubik } from "next/font/google";
import ChainBridge from "@/components/ChainBridge/ChainBridge";
import ClickSpark from "@/components/ClickSpark/ClickSpark";
import Preloader from "@/components/Preloader/Preloader";
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
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rubik.variable} ${inter.variable}`}>
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
