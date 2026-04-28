"use client";

import { useEffect, useState } from "react";
import styles from "./ButtonUp.module.css";

type Props = {
  className?: string;
};

export default function ButtonUp({ className = "" }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      className={`${styles.buttonUp} ${visible ? styles.visible : ""} ${className}`}
      aria-label="Scroll to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    />
  );
}
