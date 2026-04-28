"use client";

import styles from "./Burger.module.css";

type Props = {
  open: boolean;
  onClick: () => void;
  bgColor?: string;
  lineColor?: string;
  className?: string;
};

export default function Burger({
  open,
  onClick,
  bgColor = "rgba(149, 174, 181, 0.25)",
  lineColor = "#F5F9FA",
  className = "",
}: Props) {
  return (
    <button
      type="button"
      className={`${styles.burger} ${open ? styles.open : ""} ${className}`}
      style={{ backgroundColor: open ? "transparent" : bgColor }}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onClick}
    >
      <div className={styles.line} style={{ backgroundColor: lineColor }} />
      <div className={styles.line} style={{ backgroundColor: lineColor }} />
    </button>
  );
}
