"use client";

import { useEffect, useState, ReactNode } from "react";
import Logo from "../Logo/Logo";
import Burger from "../Burger/Burger";
import MenuPopup from "../MenuPopup/MenuPopup";
import Cursor from "../Cursor/Cursor";

type Props = {
  children: ReactNode;
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
      <Burger
        open={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        bgColor={burgerBg}
        lineColor={burgerLine}
        className={burgerClassName}
      />
      <MenuPopup open={menuOpen} onClose={() => setMenuOpen(false)} />
      {children}
    </>
  );
}
