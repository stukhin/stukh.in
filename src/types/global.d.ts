/**
 * Site-wide ambient declarations.
 *
 * `__stukhinChainFrom`: a `window`-attached scratch string set by
 * `navigateChained` right before it dispatches the `chainNavigate`
 * event. TopNav (which remounts on every cross-page navigation
 * because AppShell lives per-route) reads it to bootstrap its
 * "previous active link" state so the leaving link can animate
 * down while the new one rises. Cleared by ChainBridge once the
 * slide settles.
 *
 * Augmenting the global Window interface once here lets call sites
 * read/write the field as a regular property — no per-callsite
 * `(window as unknown as ChainWindow)` cast needed.
 */
export {};

declare global {
  interface Window {
    __stukhinChainFrom?: string;
  }
}
