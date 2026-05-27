# stukh.in — backlog / tech-debt

Refreshed 2026-05-24 at HEAD = `d8ea775`. Site is in healthy shape:
`npm run build` is clean, all 10 routes prerender, no
`eslint-disable` left in `src/`, no `TODO` / `FIXME` markers, no
inline `matchMedia` reads outside the one deliberate gesture-time
read in ChainBridge.

Use this alongside [PROJECT.md](./PROJECT.md) at session start.

---

## Deferred — cursor strict monochrome

Cursor currently uses `mix-blend-mode: difference` on a white-painted
shape (same trick as Logo). This XORs cursor pixels with bg per
pixel — great auto-contrast on neutral bgs, but **leaves a chromatic
shift on highly saturated colour bgs**. Most visible spot: hovering
a country on `/blog` (terracotta `#c14a3a` fill) — cursor reads
cyan-ish (the mathematical complement of the red).

User flagged this and accepted the trade-off for now. Future fix:
swap `mix-blend-mode: difference` for `backdrop-filter: invert(1)
grayscale(1)` + `clip-path: path(evenodd, …)` to carve the ring
shape. `clip-path` avoids the `mask` + `backdrop-filter` interaction
that broke in commit `0853bbe` (reverted in `f49b819`). Untested in
browser — needs a careful prove-then-ship pass, ideally with a
test on the country hover + WallsGallery zoom modal first.

---

## ⚑ Working protocol — design system discipline

(Added 2026-05-24 after the country-panel iteration that drifted
from the rest of the site and had to be folded back in twice.)

Every UI addition or change on this project must live INSIDE the
existing design system, not next to it. Reuse tokens before
inventing.

- **Source of truth:** `/system` (hand-maintained reference) and
  `/system/blog-panel` (per-surface audit/proposal pattern).
  Read both before starting any non-trivial UI task.
- **Canonical scales as of v5 (commit `0efbfd7`):**
  - Type ramp: 20 / 18 / 17 / 14 / 13 / 12 / 11 / 9 px
  - Weights: 200 / 300 / 400 only (no 500 / 600)
  - Letter-spacing: strict 3-value scale — `0` body, `-0.02em`
    display country name, `0.08em` every uppercase / spec label
  - Easings: `cubic-bezier(0.65, 0, 0.25, 1)` for big surfaces;
    `cubic-bezier(0.2, 0.7, 0.4, 1)` for entrance scales
  - Case: lowercase everywhere; capitalize only country names;
    uppercase only on spec / kicker labels
  - Spacing: multiples of 4; 16 / 20 / 32 / 48 / 66 / 96 most common
- **New tokens require explicit user approval.** If a feature needs
  a value outside the canonical scales, raise it first ("I need a
  new tracking value because X") and get a sign-off before adding.
- **For non-trivial UI changes, build an audit page.** Use the
  `/system/blog-panel` format: real-DOM before/after pairs, severity
  tags (high / med / low), one-paragraph rationale per row,
  numbered for approval. Apply only what's approved.
- Motion + decoration are part of the system. No inventing new
  curves, shadow recipes, or border patterns mid-task.

---

## Starting a new Claude Code session

1. **Worktree:** the project lives in a Claude worktree branch
   `claude/dazzling-swartz-cbfece` at
   `/Users/alexnderstyukhin/Projects/stukh.in/.claude/worktrees/dazzling-swartz-cbfece`.
   `npm install` already done; `node_modules/` is present.
2. **Read order:** `PROJECT.md` (architecture, page-by-page notes,
   conventions, known footguns) → this file (open backlog + lessons
   from past attempts) → only then start coding.
3. **Pick from "What's actually open" below.** The single 🔴 left is
   the LiquidEther → ogl port — sized for a dedicated session.
   Otherwise grab a 🟡 / 🟢.
4. **Deploy:** `git push origin claude/dazzling-swartz-cbfece:main`
   fast-forwards `main`; Vercel auto-deploys from `main`. The user
   prefers terse Russian, brief English in code comments. Memory:
   no preview-server screenshots — verify with `npm run build`.
   Once build is clean, commit + push without asking.
5. **Visual / WebGL changes need DevTools verification.** `npm run
   build` doesn't catch runtime WebGL failures. After deploy, ask
   the user to open Chrome → F12 → Console → reload, and report
   anything red. We have lived through that loop several times.

---

## What's actually open

### 🔴 LiquidEther port to ogl
`src/components/LiquidEther/LiquidEther.tsx` — 1175 lines, 39
`new THREE.*` call sites. The only remaining `three.js` consumer
in the codebase. Porting it lets us drop the `three` package
entirely (~140–200 KB minified gzipped saved on `/blog`). Sized
for its own session.

GridDistortion (the other historical `three.js` consumer) had a
failed ogl port saga earlier; lessons documented under
"GridDistortion ogl saga" below — apply them upfront:

- Declare every attribute / uniform / varying explicitly in the
  shader source. ogl does NOT auto-prepend the three.js
  preamble — shader silently fails to compile, the program never
  links, and Chrome's renderer can crash on `useProgram(invalid)`.
- Avoid GLSL ES 1.00 reserved words as identifiers — `packed`
  was a real landmine. Also reserved for future: `sample`, `cast`,
  `interface`, `template`, `super`.
- Wrap `renderer.render()` in try/catch so compile errors don't
  cascade into React render errors.
- Float-format textures (`RGBA32F` + `FLOAT`) are fine on Chrome
  desktop — a short detour to `RGBA8` introduced visible mouse-
  track quantisation jitter.
- Verify with **DevTools console open** before shipping.

### 🟡 Smaller items worth picking up
- **GalleryModal** (`src/components/GalleryModal/GalleryModal.tsx`,
  ~570 lines) still hosts three intertwined animation systems
  (WAAPI FLIP entrance, CSS opacity backdrop fade, rAF hover-zoom
  tracker). Each could be its own `useFlipIn` / `useHoverZoom`
  hook for clarity. No bug — readability win.
- **Shared modal-backdrop CSS recipe**: `GalleryModal.module.css`
  and `WallsGallery.module.css` both render the same `tile.webp`
  + linear-gradient overlay behind their zoom modals. Could lift
  into a shared utility class in `globals.css`.
- **Magic offsets** scattered as literal pixels across modules
  (`top: 200px / 160px / 140px` for walls filters, `top: 66px`
  for Logo, `bottom: 65px` for TopNav, `bottom: 32px` for BlogMap
  zoom controls). Promote to CSS custom properties on `:root`.
- **`BlogMap.tsx` pan write**: `recomputePan` writes
  `wrap.style.setProperty("--pan-x", …)` and `--pan-y` twice per
  mousemove frame. Combine into one batched write to save a
  style-invalidation pass per frame.
- **Preloader save-data gate**: `Preloader.tsx` preloads 21 nature
  + 5 city JPGs unconditionally. Mobile users on cellular pay
  ~6–12 MB before any interaction. Gate on
  `navigator.connection.saveData`.
- **`tsconfig.noUncheckedIndexedAccess: true`** would catch
  `arr[0]` patterns scattered in WebGL components. Currently
  unchecked.
- **GridDistortion → ogl re-attempt** (deprioritised). Currently
  on three.js, works fine, no perf issues. Porting would shave a
  bit of bundle and unify the WebGL stack with `LightRays` —
  cosmetic. Defer until LiquidEther is also ported (drops `three`
  in one go).

### 🟢 Nice-to-have, no urgency
- Pin explicit `JSX.Element` return type on exported components.
  Strict mode infers it; pinning is better DX for editor hovers.
- Eric Meyer reset in `globals.css` (35-line tag list) is overkill
  for Next 16 + modern browsers — could swap for a small modern
  reset.
- `useMediaQuery` could subscribe with AbortController instead of
  `mql.removeEventListener` for symmetry. Trivial.

---

## What shipped

Grouped by area, newest-first within each group. Commits are at
`https://github.com/stukhin/stukh.in/commit/<sha>`.

**Click-spark + cursor dissolve (May 23–24)**
- ✅ ClickSpark React-Bits port (`9d92a5f`) — viewport-wide canvas
  overlay; fires a radial burst of spark lines on clicks that lead
  to navigation. Filter: `a[href]` (covers all Next `<Link>`) +
  `data-spark="nav"` (EdgeNav opt-in). Skips `target="_blank"`.
- ✅ Spark visual tune (`2f775ce`) — radius 28 → 14, size 12 → 8;
  also adds `html.click-spark-active` so the custom cursor fades
  during the burst.
- ✅ Fade lasts through the chain (`e62c3fb`) — Cursor reads
  `chain-active` / `chain-settling` so dissolve covers the slide
  too, not just the 500 ms spark.
- ✅ Kill mid-transition flash + persist cursor pos
  (`02fea26`) — new `chain-pending` class on ChainBridge handler
  entry plugs the variable img-decode delay gap; new
  `src/lib/mousePosition.ts` survives Cursor remounts so the
  cursor fades back in at the real cursor position, not at
  (-100, -100).

**BlogMap focus-mode perf (May 24)**
- ✅ Wrap unvisited paths in a single `<g>` (`d8ea775`) — 250+
  per-path opacity transitions collapsed into one group-level
  fade. Indonesia / France focus-mode jitter fixed.
- ✅ Dropped dead `explodeStyleFor` + the `--explode-*` inline
  CSS vars that no rule ever consumed (same commit). Also the
  orphan `transform-box` / `transform-origin` / `transform 1.5s`
  transition slots from `.country` / `.visitedVisual` /
  `.visitedHit` / `.visitedDot` / `.visitedDotHit`.

**GridDistortion ogl saga (May 14–23 — net zero, lessons retained)**
- Attempted ogl port (`a07b551`) crashed Chrome's renderer →
  reverted (`748f3af`).
- Conservative retry (`ca5d2f4` + a chain of fix-ups
  `05904a0` / `1e43e60` / `04249ee` / `859f83d`) made it work but
  the visual felt different and slightly laggy.
- Briefly swapped to React-Bits FloatingLines (`84e4381`) — user
  flagged the decorative lines weren't what they wanted; just the
  cursor-warps-photo behaviour.
- Restored the original three.js GridDistortion verbatim from
  `748f3af` (`fa4a012`). End state: same as before the saga, with
  a stash of lessons baked into AUDIT + PROJECT.md footguns.

**Tech-debt cleanup (May 16)** — see `40f19f2`
- AUDIT.md and PROJECT.md got a full rewrite (this file's previous
  refresh).
- HomeSlider `isDesktopWide` alias dropped in favour of the direct
  hook value.

**Big perf — partial wins (May 15)**
- ✅ WallpaperCard IntersectionObserver gate (`da8ac34`). Off-
  screen cards render as plain `<li>`, upgrade to motion +
  springs at 400 px rootMargin. Was 120+ idle Framer Motion
  springs on `/walls` mount.
- ⚠️ `import * as THREE` → named imports in GridDistortion
  (`da8ac34`). Turbopack already tree-shook the wildcard, so the
  bundle delta was zero; cleaner code anyway.

**A11y (May 15)** — see `5b923a6`
- ✅ Focus trap + return-focus on GalleryModal and WallsGallery
  zoom modals.
- ✅ `prefers-reduced-motion` honoured by HomeSlider autoplay and
  ChainBridge slide.
- ✅ BlogMap `.zoomControls` `aria-hidden="true"` conflict with
  child `<button aria-label>` dropped.

**Tech debt (May 15)** — see `2d6c052`
- ✅ `src/lib/useMediaQuery.ts` + `MQ` constants replace 10+
  inline `matchMedia` reads. Reactive — flips on dock-switch.
  Important: call hooks unconditionally, never short-circuit
  `useMediaQuery(A) && useMediaQuery(B)` (we did that and hit
  React #311 — fix in `741e6e5`).
- ✅ `src/types/global.d.ts` — `Window.__stukhinChainFrom`
  augmentation removes per-callsite `(window as unknown as
  ChainWindow)` casts.
- ✅ `100vh` predecessor for `100dvh` in BlogMap (Safari < 15.4).
- ⚠️ `worldRaw as unknown as Topology` cast in
  `mapProjection.ts` stays — tried lifting via a
  `declare module "world-atlas/*.json"` shim, but resolveJsonModule's
  inferred JSON type wins over the shim and `feature()`'s overload
  resolver picks the wrong signature. Documented in the source.

**TOP 5 from original audit (May 10) — all closed**
- ✅ `:focus-visible` ring (`4c7471f`).
- ✅ PAGE_VISUALS mutation killed (`cf83ad0`).
- ✅ Dead-code sweep — HomeToggle / ParallaxSlider deleted,
  setTransitionDirection removed, orphan walls CSS pruned, legacy
  `logoColor` / `bgColor` props dropped (`4c7471f`).
- ✅ `LiquidEther.jsx` → `.tsx`, `tsconfig.allowJs` dropped
  (`7d7a335`).
- ✅ `BlogMap.tsx` split into `mapProjection.ts` + `CountryStroke`
  + `CountryLayer` + `DotLayer` + `BlogMapClient` dynamic wrapper
  (`e5b4eba`, `cf83ad0`).

**Other notable wins from the May arc**
- ✅ WallsGallery split — `WallpaperCard` + `FilterDropdown` lifted
  to siblings (`01fb183`).
- ✅ GridDistortion shaders extracted to `gridShaders.ts`
  (`c588c88`).
- ✅ ChainBridge `<img>` rack removed; `<link rel="preload">` is
  the single preload path (`cf83ad0`).
- ✅ BlogMap projection refactor — projection returned from the
  paths memo, dotMarkers depends on it directly (`cf83ad0`).
- ✅ `exitFocus` → `useCallback` (`cf83ad0`).
- ✅ ESLint inline disables sweep — every remaining suppression
  fixed (`c9a9c3f`). Zero `eslint-disable` left in `src/`.
- ✅ z-index conflict on BlogMap zoom controls (`5` → `8`, above
  EdgeNav).
- ✅ Cursor z-index `9999` → `200` (`25f1a00`).
- ✅ `font-family !important` in globals.css removed (`25f1a00`).
- ✅ Walls download button bumped 32 → 44 px on mobile (WCAG
  2.5.5) (`25f1a00`).
- ✅ Triple preload consolidated — link-preload only (`cf83ad0`).
- ✅ Mobile page transitions now match desktop —
  useVerticalPageSwipe drops its preview overlay, fires
  `chainNavigate` so ChainBridge runs (`2c7ca20`).
- ✅ BlogMap touch pan + pinch zoom; tap → full-screen modal
  (`2c7ca20`, `cf83ad0`).
- ✅ `useVerticalPageSwipe` gated on `hover:none AND
  pointer:coarse` (skip Windows touchscreen-laptops that report
  both) (`2d6c052`).
- ✅ Stroke trace rewrite to imperative WAAPI dashoffset
  (`50f3335`) — survived multi-subpath countries the
  `motion.path` approach didn't.

---

## Where new code landed (since the last refresh)

| Path | Purpose |
|---|---|
| `src/components/ClickSpark/ClickSpark.tsx` | Viewport-wide click-burst overlay, nav-only filter, theme-aware colour. Mounted in `app/layout.tsx`. |
| `src/lib/mousePosition.ts` | Tiny `{x, y}` module storage so the custom Cursor's position survives across per-route remounts. |
| `html.click-spark-active` class | Set by ClickSpark while sparks are alive. Cursor reads it via CSS to fade out. |
| `html.chain-pending` class | Set by ChainBridge synchronously on handler entry, removed in the final cleanup. Cursor reads it via CSS to stay faded through the full chain timeline. |
| `<g class="unvisitedGroup">` in BlogMap | Wraps 250+ unvisited country paths; opacity transition lives on the group so focus-mode fade is GPU-cheap. |
