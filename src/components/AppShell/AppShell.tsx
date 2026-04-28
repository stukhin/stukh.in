"use client";

import { useState, ReactNode } from "react";
import Logo from "../Logo/Logo";
import Burger from "../Burger/Burger";
import MenuPopup from "../MenuPopup/MenuPopup";
import Cursor from "../Cursor/Cursor";

type Props = {
  children: ReactNode;
  logoColor?: string;
  cursorVariant?: "light" | "dark";
  burgerBg?: string;
  burgerLine?: string;
  logoNoClick?: boolean;
  burgerClassName?: string;
};

export default function AppShell({
  children,
  logoColor = "#fff",
  cursorVariant = "light",
  burgerBg = "rgba(149, 174, 181, 0.25)",
  burgerLine = "#F5F9FA",
  logoNoClick = false,
  burgerClassName = "",
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <Cursor variant={cursorVariant} />
      <Logo color={logoColor} noClick={logoNoClick} />
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
