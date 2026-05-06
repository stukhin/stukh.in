"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  PAGE_ORDER,
  navigateChained,
} from "@/lib/pageOrder";
import styles from "./EdgeNav.module.css";

/**
 * Click zones at the very top and bottom of the viewport. They flip
 * pages in PAGE_ORDER so the user can scroll through the strip
 * without having to open the burger menu every time:
 *   - top edge: previous page (slide down — backward direction)
 *   - bottom edge: next page (slide up — forward direction)
 *
 * The zones are kept narrow (60% width) so they don't fight with the
 * gallery's left/right edge zones (which sit at 20% on each side and
 * already navigate within the gallery).
 */
export default function EdgeNav() {
  const pathname = usePathname();
  const router = useRouter();

  const idx = PAGE_ORDER.indexOf(pathname);
  if (idx === -1) return null;

  const prevHref = idx > 0 ? PAGE_ORDER[idx - 1] : null;
  const nextHref = idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null;

  const goPrev = () => {
    if (!prevHref) return;
    navigateChained(router, pathname, prevHref);
  };

  const goNext = () => {
    if (!nextHref) return;
    navigateChained(router, pathname, nextHref);
  };

  return (
    <>
      {prevHref && (
        <button
          type="button"
          className={`${styles.zone} ${styles.top}`}
          onClick={goPrev}
          aria-label={`Go to previous section (${prevHref})`}
          data-cursor="arrow-up"
        />
      )}
      {nextHref && (
        <button
          type="button"
          className={`${styles.zone} ${styles.bottom}`}
          onClick={goNext}
          aria-label={`Go to next section (${nextHref})`}
          data-cursor="arrow-down"
        />
      )}
    </>
  );
}
