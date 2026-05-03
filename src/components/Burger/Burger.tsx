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
  // The frosted-glass background is now CSS-driven, so colour props
  // become vestigial. We keep them on the type for backwards
  // compatibility with the page-level AppShell calls.
  bgColor: _bgColor,
  lineColor: _lineColor,
  className = "",
}: Props) {
  void _bgColor;
  void _lineColor;
  return (
    <button
      type="button"
      className={`${styles.burger} ${open ? styles.open : ""} ${className}`}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onClick}
    >
      <div className={styles.line} />
      <div className={styles.line} />
    </button>
  );
}
