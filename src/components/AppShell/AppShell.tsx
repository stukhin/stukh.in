"use client";

import { useEffect, useState, ReactNode } from "react";
import Logo from "../Logo/Logo";
import Burger from "../Burger/Burger";
import MenuPopup from "../MenuPopup/MenuPopup";
import TopNav from "../TopNav/TopNav";
import Cursor from "../Cursor/Cursor";
import EdgeNav from "../EdgeNav/EdgeNav";

type Theme = "light" | "dark";
type CursorVariant = "light" | "dark";

type Props = {
  children: ReactNode;
  /**
   * Light or dark theme for the persistent shell (logo, top-nav,
   * socials). Pages with bright backgrounds (city) opt into "light";
   * everything else stays "dark" (white glyphs on dark). The home
   * page may override this dynamically per-slide via HomeSlider.
   */
  theme?: Theme;
  /**
   * Theme to flip to once the user has scrolled past the hero
   * (default: 200px). Used by /order, which has a dark hero on top
   * of a white content section. Without this the shell stays in
   * `theme` for the whole page.
   */
  themeScrolled?: Theme;
  /** Pixel scroll position at which themeScrolled / cursorVariantScrolled kick in. */
  scrollThreshold?: number;
  cursorVariant?: CursorVariant;
  cursorVariantScrolled?: CursorVariant;
  /** Legacy — no longer affects rendering; kept for prop-API compat. */
  logoColor?: string;
  logoColorScrolled?: string;
  burgerBg?: string;
  burgerLine?: string;
  logoNoClick?: boolean;
  burgerClassName?: string;
};

export default function AppShell({
  children,
  theme,
  themeScrolled,
  scrollThreshold = 200,
  cursorVariant = "light",
  cursorVariantScrolled,
  burgerBg = "rgba(149, 174, 181, 0.25)",
  burgerLine = "#F5F9FA",
  logoNoClick = false,
  burgerClassName = "",
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll position when either themeScrolled or
  // cursorVariantScrolled is provided. Single observer handles both.
  useEffect(() => {
    if (!themeScrolled && !cursorVariantScrolled) return;
    const onScroll = () => setScrolled(window.scrollY > scrollThreshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [themeScrolled, cursorVariantScrolled, scrollThreshold]);

  // Resolve effective theme (post-scroll override) and apply to
  // <html> via data-attribute. CSS variables in globals.css read it
  // and flip every shell colour (logo / nav / socials) at once.
  // Home omits both props and lets HomeSlider drive it dynamically.
  const effectiveTheme = scrolled && themeScrolled ? themeScrolled : theme;
  useEffect(() => {
    if (!effectiveTheme) return;
    document.documentElement.dataset.theme = effectiveTheme;
  }, [effectiveTheme]);

  const effectiveCursor =
    scrolled && cursorVariantScrolled ? cursorVariantScrolled : cursorVariant;

  return (
    <>
      <Cursor variant={effectiveCursor} />
      <Logo noClick={logoNoClick} />
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
