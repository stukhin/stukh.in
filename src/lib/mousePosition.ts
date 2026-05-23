/**
 * Module-level storage for the last known mouse position. Survives
 * across React component remounts — useful for the custom Cursor,
 * which mounts inside `AppShell` (per-route) and would otherwise
 * lose its position state every time the user navigates to a new
 * page.
 *
 * Without this, a fresh Cursor instance starts at the React-default
 * (-100, -100) off-screen position, fades back in there, and only
 * "snaps" onto the actual cursor location when the user moves the
 * mouse. With it, the new instance reads the saved position on
 * mount and the fade-in lands where the cursor actually is.
 *
 * Updated from inside Cursor.tsx on every mousemove. Doesn't need
 * to be subscribable — Cursor reads it ONCE on mount via its
 * useState initializer, then maintains its own state from that
 * point.
 */
let lastX = -100;
let lastY = -100;

export function getLastMousePosition(): { x: number; y: number } {
  return { x: lastX, y: lastY };
}

export function setLastMousePosition(x: number, y: number): void {
  lastX = x;
  lastY = y;
}
