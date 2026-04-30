"use client";

import { Link, useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { MouseEvent } from "react";
import { navigateChained } from "@/lib/pageOrder";
import styles from "./TopNav.module.css";

type Props = {
  /**
   * Text colour. Pages pass this so the nav stays contrasty against
   * each page's background (light cities, dark grids, etc.).
   */
  color?: string;
  className?: string;
};

const links = [
  { href: "/nature", label: "nature" },
  { href: "/city", label: "city" },
  { href: "/walls", label: "walls" },
  { href: "/blog", label: "blog" },
];

/**
 * Pinned horizontal site nav for desktop. Replaces the burger on
 * desktop sizes; the burger keeps its job on mobile (CSS hides each
 * on the wrong viewport). The whole nav rides through view-transitions
 * as the `site-nav` group so it stays put across page-to-page slides.
 */
export default function TopNav({ color = "#fff", className = "" }: Props) {
  const pathname = usePathname();
  const router = useTransitionRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) return;
    e.preventDefault();
    navigateChained(router, pathname, href);
  };

  return (
    <nav
      className={`${styles.nav} ${className}`}
      style={{ color }}
      aria-label="Site navigation"
    >
      <ul className={styles.list}>
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.link} ${isActive ? styles.active : ""}`}
                onClick={(e) => handleClick(e, link.href)}
                aria-label={`Go to ${link.label}`}
                data-cursor="hover"
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
