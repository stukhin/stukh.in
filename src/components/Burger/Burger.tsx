"use client";

import styles from "./Burger.module.css";

type Props = {
  open: boolean;
  onClick: () => void;
  className?: string;
};

export default function Burger({
  open,
  onClick,
  className = "",
}: Props) {
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
