"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  CSSProperties,
  MouseEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { navigateChained } from "@/lib/pageOrder";
import styles from "./TopNav.module.css";

type Props = {
  /**
   * Reserved for parity with other shell components. The nav itself
   * uses mix-blend-mode: difference to auto-invert against whatever
   * is painted behind it, so this is currently a no-op.
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

const TYPED_KEY = "topnav.typed";

type Schedule = {
  /** Per-link, per-letter animation-delay in ms. */
  letterDelays: number[][];
  /** Per-link underline fade-in delay in ms. */
  underlineDelays: number[];
  /** Total duration including the trailing fade so the parent can
   *  decide when to drop the .typing class. */
  total: number;
};

/**
 * Build a fresh typing schedule on the client. The cadence is
 * deliberately uneven (~30–90 ms per letter) so the entrance reads
 * as someone actually typing rather than a metronomic CSS sweep.
 * Underlines drop in once the last letter has landed, in left-to-right
 * order.
 */
function buildSchedule(): Schedule {
  let cursor = 140; // tiny pre-roll so the page settles first
  const letterDelays: number[][] = [];
  for (const link of links) {
    const perLink: number[] = [];
    for (let i = 0; i < link.label.length; i++) {
      cursor += 30 + Math.random() * 60;
      perLink.push(Math.round(cursor));
    }
    cursor += 70; // small breath between words
    letterDelays.push(perLink);
  }
  const underlineStart = Math.round(cursor + 110);
  const underlineDelays = links.map((_, i) => underlineStart + i * 95);
  const total = underlineDelays[underlineDelays.length - 1] + 320;
  return { letterDelays, underlineDelays, total };
}

/**
 * Pinned horizontal site nav for desktop. Replaces the burger on
 * desktop sizes; the burger keeps its job on mobile (CSS hides each
 * on the wrong viewport). The whole nav rides through view-transitions
 * as the `site-nav` group so it stays put across page-to-page slides.
 *
 * On the very first hard page load of a tab, the labels "type
 * themselves in" — letters appear one by one with a slightly uneven
 * cadence, then the underlines drop in left-to-right. Once the
 * entrance finishes we mark `topnav.typed` in sessionStorage so
 * subsequent renders in the same tab (or any client-side route
 * change) keep the menu static. Reloading the tab gets you the
 * entrance again, which is when it actually adds value.
 *
 * The nav is non-interactive while typing so the user can't click a
 * half-rendered link.
 */
export default function TopNav({ className = "" }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  // `typing` flips on briefly during the entrance. Default false so
  // SSR + first client render produce the same "static labels" markup
  // (no hydration mismatch); we kick the entrance off in a layout
  // effect after mount, before the first paint.
  const [typing, setTyping] = useState(false);
  const scheduleRef = useRef<Schedule | null>(null);

  useLayoutEffect(() => {
    let alreadyTyped = false;
    try {
      alreadyTyped = sessionStorage.getItem(TYPED_KEY) === "1";
    } catch {
      // Private mode / disabled storage — just skip the entrance.
      return;
    }
    if (alreadyTyped) return;

    scheduleRef.current = buildSchedule();
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      try {
        sessionStorage.setItem(TYPED_KEY, "1");
      } catch {}
    }, scheduleRef.current.total);
    return () => window.clearTimeout(t);
  }, []);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (typing) {
      // Block clicks until the entrance animation finishes — the
      // menu isn't fully drawn yet.
      e.preventDefault();
      return;
    }
    if (pathname === href) return;
    e.preventDefault();
    navigateChained(router, pathname, href);
  };

  const schedule = scheduleRef.current;
  const showLetters = typing && schedule !== null;

  return (
    <nav
      className={`${styles.nav} ${className} ${
        typing ? styles.typing : ""
      }`}
      aria-label="Site navigation"
    >
      <ul className={styles.list}>
        {links.map((link, linkIdx) => {
          const isActive = pathname === link.href;
          const letterDelays = showLetters ? schedule!.letterDelays[linkIdx] : null;
          const underlineDelay = showLetters
            ? schedule!.underlineDelays[linkIdx]
            : 0;
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${styles.link} ${isActive ? styles.active : ""}`}
                onClick={(e) => handleClick(e, link.href)}
                aria-label={`Go to ${link.label}`}
                data-cursor="hover"
              >
                {showLetters && letterDelays
                  ? link.label.split("").map((ch, i) => (
                      <span
                        key={i}
                        className={styles.letter}
                        style={
                          {
                            "--letter-delay": `${letterDelays[i]}ms`,
                          } as CSSProperties
                        }
                      >
                        {ch}
                      </span>
                    ))
                  : link.label}
                <span
                  className={styles.underline}
                  style={
                    showLetters
                      ? ({
                          "--underline-delay": `${underlineDelay}ms`,
                        } as CSSProperties)
                      : undefined
                  }
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
