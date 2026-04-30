"use client";

import { useEffect, useState, ReactNode } from "react";
import Logo from "../Logo/Logo";
import Burger from "../Burger/Burger";
import MenuPopup from "../MenuPopup/MenuPopup";
import TopNav from "../TopNav/TopNav";
import Cursor from "../Cursor/Cursor";
import EdgeNav from "../EdgeNav/EdgeNav";

type Props = {
  children: ReactNode;
  logoColor?: string;
  logoColorScrolled?: string;
  /**
   * Optional override for the desktop TopNav text colour. Defaults to
   * logoColor (and logoColorScrolled), so most pages don't need to
   * pass anything special — the logo and the nav stay coloured the
   * same way.
   */
  navColor?: string;
  cursorVariant?: "light" | "dark";
  burgerBg?: string;
  burgerLine?: string;
  logoNoClick?: boolean;
  burgerClassName?: string;
};

export default function AppShell({
  children,
  logoColor = "#fff",
  logoColorScrolled,
  navColor,
  cursorVariant = "light",
  burgerBg = "rgba(149, 174, 181, 0.25)",
  burgerLine = "#F5F9FA",
  logoNoClick = false,
  burgerClassName = "",
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
  const currentNavColor = navColor ?? currentLogoColor;

  return (
    <>
      <Cursor variant={cursorVariant} />
      <Logo color={currentLogoColor} noClick={logoNoClick} />
      <TopNav color={currentNavColor} />
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
