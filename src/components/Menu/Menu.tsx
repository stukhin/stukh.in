"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Menu.module.css";

type Props = {
  column?: boolean;
  className?: string;
};

const links = [
  { href: "/nature", label: "nature" },
  { href: "/city", label: "city" },
  { href: "/walls", label: "walls" },
  { href: "/trips", label: "trips" },
];

export default function Menu({ column = false, className = "" }: Props) {
  const pathname = usePathname();
  const classes = [
    styles.menu,
    column ? styles.column : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

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
