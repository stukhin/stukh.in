"use client";

import { useEffect, useState, ReactNode } from "react";
import Logo from "../Logo/Logo";
import Burger from "../Burger/Burger";
import MenuPopup from "../MenuPopup/MenuPopup";
import TopNav from "../TopNav/TopNav";
import Cursor from "../Cursor/Cursor";
import EdgeNav from "../EdgeNav/EdgeNav";

type Theme = "light" | "dark";

type Props = {
  children: ReactNode;
  /**
   * Light or dark theme for the persistent shell (logo, top-nav,
   * socials). Pages with bright backgrounds (city) opt into "light";
   * everything else stays "dark" (white glyphs on dark). The home
   * page may override this dynamically per-slide via HomeSlider.
   */
  theme?: Theme;
  logoColor?: string;
  logoColorScrolled?: string;
  cursorVariant?: "light" | "dark";
  burgerBg?: string;
  burgerLine?: string;
  logoNoClick?: boolean;
  burgerClassName?: string;
};

export default function AppShell({
  children,
  theme,
  logoColor = "#fff",
  logoColorScrolled,
  cursorVariant = "light",
  burgerBg = "rgba(149, 174, 181, 0.25)",
  burgerLine = "#F5F9FA",
  logoNoClick = false,
  burgerClassName = "",
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Apply the page's static theme to <html> via a data-attribute. The
  // CSS variables in globals.css read it and flip every shell colour
  // (logo / nav / socials) at once. Home omits the prop and lets
  // HomeSlider drive it dynamically per-slide instead.
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Switch the logo to logoColorScrolled once the user has scrolled past the
  // hero area (only applies if a scrolled colour is provided).
  useEffect(() => {
    if (!logoColorScrolled) return;
    const onScroll = () => setScrolled(window.scrollY > 200);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [logoColorScrolled]);

  const currentLogoColor = scrolled && logoColorScrolled ? logoColorScrolled : logoColor;

  return (
    <>
      <Cursor variant={cursorVariant} />
      <Logo color={currentLogoColor} noClick={logoNoClick} />
      <TopNav />
      <Burger
        open={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        bgColor={burgerBg}
        lineColor={burgerLine}
        className={burgerClassName}
      />
      <MenuPopup open={menuOpen} onClose={() => setMenuOpen(false)} />
      <EdgeNav />
      {children}
    </>
  );
}
