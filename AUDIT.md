# stukh.in — backlog / tech-debt

Refreshed 2026-05-16 after the cleanup arc that closed almost every
🔴 / 🟡 item the original snapshot (commit `51701a3`, May 10) had
flagged. The site is in a healthy state — `npm run build` clean, all
10 routes prerender, no `eslint-disable` left in `src/`, no
`TODO` / `FIXME` markers, no inline `matchMedia` reads outside the
one deliberate gesture-time read in ChainBridge.

Use this alongside [PROJECT.md](./PROJECT.md) at session start.

---

## What's actually open

### 🔴 LiquidEther port to ogl
`src/components/LiquidEther/LiquidEther.tsx` is the only remaining
`three.js` consumer in the codebase — 1175 lines, 39 `new THREE.*`
call sites. Porting it lets us drop the `three` package entirely.
Expected savings: ~140–200 KB minified gzipped on `/blog`. Sized
for its own session. Lessons from the FloatingLines saga (below)
suggest the port should: declare every attribute / uniform / varying
explicitly in the shader source (ogl doesn't auto-prepend three's
preamble), avoid GLSL ES 1.00 reserved words as identifiers
(`packed` was a real landmine), wrap render() in try/catch, and
verify with DevTools open before shipping — `npm run build` does
not catch runtime WebGL failures.

### 🟡 Smaller items worth picking up

- **GalleryModal** (`src/components/GalleryModal/GalleryModal.tsx`,
  ~570 lines) still hosts three intertwined animation systems: the
  WAAPI FLIP entrance, CSS opacity backdrop fade, and the rAF
  hover-zoom tracker. Each could be its own `useFlipIn` /
  `useHoverZoom` hook for clarity. No bug — just a future readability
  win. Tagged 🟡 on the original audit, never escalated.
- **Shared CSS recipes**: `GalleryModal.module.css` and
  `WallsGallery.module.css` both render the same `tile.webp` +
  linear-gradient overlay behind their zoom modals. Could be lifted
  into a `.modalBackdrop` utility class shared from `globals.css`.
- **Magic offsets** scattered as literal pixels across modules
  (`top: 200px / 160px / 140px` for walls filters, `top: 66px`
  for the Logo, `bottom: 65px` for TopNav, `bottom: 32px` for
  BlogMap zoom controls). Could promote to CSS custom properties on
  `:root`. Mostly stylistic.
- **`BlogMap.tsx` pan write**: `recomputePan` writes
  `wrap.style.setProperty("--pan-x", …)` and `--pan-y` twice per
  mousemove frame. Combining into a single `style.cssText` or batched
  write would save a style-invalidation pass. Cheap.
- **Preloader save-data gate**: `Preloader.tsx` preloads 21 nature +
  5 city JPGs unconditionally. Mobile users on cellular pay ~6–12 MB
  before any interaction. Gate on `navigator.connection.saveData`.
- **`tsconfig`** flag `noUncheckedIndexedAccess: true` would catch the
  `arr[0]` patterns scattered in WebGL components — currently
  unchecked, occasionally bites in the form of `arr[i]` being `T`
  rather than `T | undefined`.

### 🟢 Nice-to-have, no urgency
- Pin explicit `JSX.Element` return type on exported components.
  Strict mode infers it, but pinning is better DX for editor hovers.
- Eric Meyer reset in `globals.css` (35-line tag list) is overkill
  for Next 16 + modern browsers — could swap for a small modern reset.
- Bare `useMediaQuery` could also subscribe to `change` events with
  AbortController instead of `mql.removeEventListener` for symmetry —
  trivial.

---

## What shipped since `51701a3`

The original AUDIT's full backlog has been processed top-to-bottom.
Grouped by area:

**TOP 5 — all closed**
- ✅ `:focus-visible` indicator everywhere — `globals.css` adds an
  outline-based ring scoped to `:focus-visible` (commit `4c7471f`).
- ✅ PAGE_VISUALS mutation killed — `Readonly<…>` + `setRouteBg` /
  `getRouteBg` API (`cf83ad0`).
- ✅ Dead-code sweep — `HomeToggle` / `ParallaxSlider` deleted,
  `setTransitionDirection` removed, orphan walls CSS pruned, legacy
  `logoColor` / `bgColor` props dropped (`4c7471f`).
- ✅ `LiquidEther.jsx` → `.tsx`, `tsconfig.allowJs` dropped
  (`7d7a335`).
- ✅ `BlogMap.tsx` split into `mapProjection.ts` + `CountryStroke` +
  `CountryLayer` + `DotLayer` + `BlogMapClient` wrapper, dynamic-
  imported with `ssr: false` (`e5b4eba`, `cf83ad0`).

**Component bloat & dead code**
- ✅ WallsGallery split — `WallpaperCard` + `FilterDropdown` lifted
  to siblings (`01fb183`).
- ✅ GridDistortion swapped for FloatingLines as the home hero
  effect after multiple failed ogl porting attempts. GridDistortion
  folder deleted; FloatingLines is a TS port of the React Bits
  three.js component, overlaid on the slide photo with
  mix-blend-mode: screen.
- ✅ ChainBridge `<img>` rack removed; `<link rel="preload">` is the
  single preload path now (`cf83ad0`).

**CSS smells**
- ✅ Z-index conflict on BlogMap zoom controls fixed (5 → 8, above
  EdgeNav) (`cf83ad0`).
- ✅ Cursor z-index 9999 → 200 (`25f1a00`).
- ✅ `font-family !important` in globals.css removed (`25f1a00`).
- ✅ GallerySlider `width !important` documented with rationale
  (Swiper inline-styles override) (`25f1a00`).

**React anti-patterns**
- ✅ BlogMap `useMemo` projection refactor — projection returned
  from the paths memo, dotMarkers depends on it directly (`cf83ad0`).
- ✅ `exitFocus` → `useCallback`, `eslint-disable` dropped
  (`cf83ad0`).
- ✅ ESLint inline disables sweep — every remaining suppression
  fixed by promoting handlers to `useCallback` with correct deps
  (`c9a9c3f`). Zero `eslint-disable` left in `src/`.

**TypeScript**
- ✅ `LightRays` / (former) `GridDistortion` `any` on uniforms / renderer /
  mesh refs — typed properly (`7d7a335`).
- ✅ `Window` augmentation in `src/types/global.d.ts` —
  `__stukhinChainFrom` is a regular property now, no per-callsite
  `(window as unknown as ChainWindow)` cast (`2d6c052`).
- ⚠️ `worldRaw as unknown as Topology` cast in
  `mapProjection.ts` kept — tried lifting via `declare module
  "world-atlas/*.json"` shim, but `resolveJsonModule`'s inferred
  JSON type wins over the shim and `feature()`'s overload resolver
  picks the wrong signature. Documented in the source.

**Performance**
- ✅ Triple preload consolidated — link-preload only (`cf83ad0`).
- ✅ WallpaperCard IntersectionObserver gate — off-screen cards
  render as plain `<li>`, upgrade to motion + springs at 400 px
  rootMargin (`da8ac34`). Was 120+ idle springs on `/walls` mount.
- ⚠️ GridDistortion port to ogl attempted twice (`a07b551`,
  `ca5d2f4` + `05904a0` + `1e43e60` + `04249ee` + `859f83d`) and
  reverted / ultimately replaced. Root cause of the crashes:
  ogl, unlike three.js, does not auto-prepend `attribute vec3
  position;` etc. to vertex shaders, and the GLSL ES 1.00 reserved
  word `packed` was used as an identifier. The fixes shipped but
  perf still wasn't great and the mouse-warp visual didn't carry
  the same wow, so the user opted to swap the effect entirely.
  See "GridDistortion → FloatingLines" below.
- ✅ `useMediaQuery` hook + `MQ` constants replace 10+ inline
  `matchMedia` reads (`2d6c052`). Reactive — flips on dock-switch.

**Accessibility**
- ✅ Focus trap + return-focus on GalleryModal and WallsGallery zoom
  modals (`5b923a6`).
- ✅ `prefers-reduced-motion` honoured by HomeSlider autoplay and
  ChainBridge slide animation (`5b923a6`).
- ✅ BlogMap `.zoomControls` `aria-hidden="true"` conflict with
  child `<button aria-label>` dropped (`5b923a6`).
- ✅ Walls download button bumped to 44 × 44 on mobile to meet WCAG
  2.5.5 (`25f1a00`).

**Mobile / responsive**
- ✅ Mobile page transitions now match desktop — useVerticalPageSwipe
  drops its custom preview overlay, fires `chainNavigate` on commit
  so ChainBridge runs (`2c7ca20`).
- ✅ BlogMap touch pan + pinch zoom; tap → full-screen modal
  (`2c7ca20`, `cf83ad0`).
- ✅ `useVerticalPageSwipe` gated on `hover:none AND pointer:coarse`
  to skip Windows touchscreen-laptops that report both (`2d6c052`).
- ✅ `100vh` predecessor for `100dvh` in BlogMap for Safari < 15.4
  (`2d6c052`).

**Build / DX**
- ✅ `allowJs` flag dropped from `tsconfig.json` (`7d7a335`).
- ✅ `exif-reader` removed from devDependencies (`25f1a00`).

**Naming / docs drift**
- ✅ `Preloader.tsx` `HOME_INTRO_KEY` / `PRELOADER_DONE_EVENT` exports
  demoted to module-local (`25f1a00`).
- ✅ 110m → 50m docs drift fixed in BlogMap + visits (`25f1a00`).
- ✅ `/system` motion table rewritten with current source-of-truth
  values (`25f1a00`).
- ✅ AppShell legacy "kept for prop-API compat" props removed
  (`4c7471f`).

**Bug fixes that came up along the way**
- ✅ Country stroke trace no longer underdraws — switched
  `motion.path` (which regressed on 50m multi-subpath geometries)
  for imperative WAAPI `dashoffset` driven from
  `getTotalLength()` (`50f3335`).

---

## Starting a new session

1. Read `PROJECT.md` (architecture) + this file (backlog).
2. The only 🔴 left is the LiquidEther port — sized for its own
   session. Pick a 🟡 if you want something smaller.
3. `npm run build` to verify; deploy = push to `main` (Vercel auto-
   deploys). Note the repo uses a Claude worktree on
   `claude/dazzling-swartz-cbfece`; push that branch to `main`
   directly (`git push origin claude/dazzling-swartz-cbfece:main`).
4. The user prefers brief Russian responses, terse English in code
   comments. Memory: no preview screenshots — verify with `npm run
   build`. Once build is clean, commit + push without asking.
