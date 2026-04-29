"use client";

import { Link } from "next-view-transitions";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { MouseEvent } from "react";
import styles from "./Menu.module.css";

type Props = {
  column?: boolean;
  className?: string;
  /**
   * Called right after a link is clicked. Used by MenuPopup so it can
   * start its close animation before the page transition fires.
   */
  onNavigate?: () => void;
  /**
   * If set, the link click is delayed by this many ms before the actual
   * navigation. This gives the menu popup time to fade out before the
   * cross-page slide kicks in.
   */
  navigateDelayMs?: number;
};

const links = [
  { href: "/nature", label: "nature" },
  { href: "/city", label: "city" },
  { href: "/walls", label: "walls" },
  { href: "/trips", label: "trips" },
];

export default function Menu({
  column = false,
  className = "",
  onNavigate,
  navigateDelayMs = 0,
}: Props) {
  const pathname = usePathname();
  const router = useTransitionRouter();
  const classes = [styles.menu, column ? styles.column : "", className]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) return;
    e.preventDefault();
    onNavigate?.();
    if (navigateDelayMs > 0) {
      window.setTimeout(() => router.push(href), navigateDelayMs);
    } else {
      router.push(href);
    }
  };

  return (
    <nav className={classes} aria-label="Main menu">
      <ul>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                aria-label={`Go to ${link.label} page`}
                className={`${styles.link} ${isActive ? styles.active : ""}`}
                href={link.href}
                onClick={(e) => handleClick(e, link.href)}
              >
                {link.label}
                <span className={styles.underline} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
