"use client";

import { CSSProperties, useEffect, useRef, useState } from "react";
import styles from "./WallsGallery.module.css";

export type FilterOption = {
  value: string;
  label: string;
  /**
   * Optional accent colour for the option — used by the tone list so
   * "warm", "cool", etc. read in their tuned hue. Categories pass
   * undefined and fall back to plain white.
   */
  color?: string;
};

type Props = {
  /** Tiny label rendered before the current value, e.g. "type:". */
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (next: string) => void;
};

/**
 * Compact custom dropdown that replaces the old vertical sidebar
 * filter lists. Two of these (type + color) sit at the top of the
 * walls grid. Clicking the trigger opens a frosted menu below;
 * clicking outside the dropdown or pressing Escape closes it.
 *
 * Custom rather than native <select> because the page-wide custom
 * cursor doesn't reach into native control internals (the OS owns
 * the open/closed UI), and because we want the option text in the
 * same lowercase Inter weight 200 the rest of the filter chrome
 * uses, with per-option accent colours for the tone list.
 */
export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: globalThis.MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={styles.dropdown} ref={ref}>
      <button
        type="button"
        className={`${styles.dropdownTrigger} ${
          open ? styles.dropdownTriggerOpen : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-cursor="hover"
        style={
          current?.color
            ? ({ "--opt-color": current.color } as CSSProperties)
            : undefined
        }
      >
        <span className={styles.dropdownLabel}>{label}:</span>
        <span className={styles.dropdownValue}>
          {current?.label ?? options[0]?.label ?? ""}
        </span>
        <span className={styles.dropdownChevron} aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <ul className={styles.dropdownMenu} role="listbox">
          {options.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                className={`${styles.dropdownOption} ${
                  opt.value === value ? styles.dropdownOptionActive : ""
                }`}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                data-cursor="hover"
                style={
                  opt.color
                    ? ({ "--opt-color": opt.color } as CSSProperties)
                    : undefined
                }
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
