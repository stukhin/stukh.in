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
  /**
   * AppShell (and therefore TopNav) is mounted per-page, so the nav
   * remounts on every chained navigation. If we marked the new
   * active link via pathname directly, the underline would render
   * already at translateY(-44px) on first paint and the CSS
   * transition wouldn't fire (no value change between renders) —
   * the user reads that as "no animation, just snaps."
   *
   * Workaround: when we mount mid-chain (html.chain-active class
   * is set), start with no active link, then promote pathname →
   * activeLink on the second paint frame. The underline's value
   * transitions from idle (translate -50% 0) to active
   * (translate -50% -44px) over its CSS easing, riding through
   * the chain-bridge slide.
   *
   * On a hard load (no chain) we initialise with pathname so the
   * server-rendered markup already has the active link and the
   * client hydrates without a flicker.
   */
  const [activePath, setActivePath] = useState<string | null>(() => {
    if (typeof document === "undefined") return pathname;
    return document.documentElement.classList.contains("chain-active")
      ? null
      : pathname;
  });

  useLayoutEffect(() => {
    if (activePath === null) {
      let r1 = 0;
      let r2 = 0;
      r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => {
          setActivePath(pathname);
        });
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    if (activePath !== pathname) setActivePath(pathname);
    // Intentionally only depend on pathname — activePath changes
    // shouldn't retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
          const isActive = activePath === link.href;
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
