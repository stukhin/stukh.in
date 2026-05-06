import type { Metadata, Viewport } from "next";
import ChainBridge from "@/components/ChainBridge/ChainBridge";
import "./globals.css";

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
    <html lang="en">
      <body>
        {children}
        <ChainBridge />
      </body>
    </html>
  );
}
