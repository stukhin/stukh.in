"use client";

import { useEffect, useState } from "react";
import OrderLink from "../OrderLink/OrderLink";
import styles from "./OrderMenu.module.css";

type Props = {
  /** Explicit override. When undefined the component tracks scroll itself and
   *  hides once the user has scrolled past the hero. */
  hidden?: boolean;
  /** Scroll distance (px) after which the menu fades out. */
  hideAfter?: number;
};

export default function OrderMenu({ hidden, hideAfter = 400 }: Props) {
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    if (hidden !== undefined) return; // controlled externally
    const onScroll = () => setScrolledPast(window.scrollY > hideAfter);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hidden, hideAfter]);

  const isHidden = hidden ?? scrolledPast;

  const scrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`${styles.orderMenu} ${isHidden ? styles.hidden : ""}`}>
      <ul>
        <li>
          <OrderLink onClick={scrollTo("prints")}>prints</OrderLink>
        </li>
        <li>
          <OrderLink onClick={scrollTo("shoots")}>shoot</OrderLink>
        </li>
        <li>
          <OrderLink onClick={scrollTo("touch")}>touch</OrderLink>
        </li>
      </ul>
    </nav>
  );
}
