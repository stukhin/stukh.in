# stukh.in — backlog / tech-debt

Generated 2026-05-10 after a critical QA pass through `src/`. Reflects state
at commit `51701a3`. Use this alongside [PROJECT.md](./PROJECT.md) when
starting a new session.

The list is opinionated and picky on purpose — not every item is a real
bug, but every item is something a maintainer should know about. Group by
priority; "TOP 5" at the bottom is the actually-shipping shortlist.

---

## TOP 5 — start here

1. **a11y / `:focus-visible` everywhere.** Global `* { cursor: none }` +
   nothing reads `:focus-visible` = keyboard users have zero focus
   indicator across the whole site. Single biggest UX miss. ~30 lines of
   CSS to fix.
2. **Stop mutating `PAGE_VISUALS["/"].bg` from `HomeSlider`** (`HomeSlider.tsx:65`).
   Module-level object written from `useEffect` as a side effect. Replace
   with a `CustomEvent`, a small `pageVisualsStore.ts`, or a ref module.
   Race-prone in React 18 concurrent / StrictMode double-render.
3. **Delete dead code.** No behavioural risk, ~600 lines of pure
   maintenance win:
   - `src/components/HomeToggle/` — not imported anywhere.
   - `src/components/ParallaxSlider/` — not imported anywhere.
   - `setTransitionDirection` in `src/lib/pageOrder.ts:25-32` — writes
     CSS classes no selector reads.
   - `WallsGallery.module.css:366-608` — `.chunk`, `.chunk1-6`, `.info`,
     `.cardTitle`, `.meta`, `.story`, `.specs`, `.ghost*` — orphaned
     after the hover-plate refactor.
   - `logoColor` / `logoColorScrolled` props on `AppShell.tsx`.
   - `bgColor` / `lineColor` props on `Burger.tsx`.
4. **Convert `LiquidEther.jsx` → `.tsx`** and drop `"allowJs": true` from
   `tsconfig.json`. 1175-line escape hatch from strict mode. Mostly
   mechanical conversion.
5. **Split `BlogMap.tsx` (912 lines)** and `dynamic`-import it with
   `{ ssr: false }`. Suggested split: `useMapProjection`, `useCursorPan`,
   `useFocusMode`, `useLatLongOverlay` hooks; `<CountryLayer>`,
   `<DotLayer>` components. Halves the per-render code and removes
   ~300 KB from non-`/blog` routes.

---

## Full findings

### 1. Component bloat 🔴🟡

- 🔴 `BlogMap.tsx` — 912 lines, see TOP 5 #5.
- 🔴 `WallsGallery.tsx` — 711 lines. `WallpaperCard` (lines 475-595) and
  `FilterDropdown` (lines 595-705) are colocated. Move to sibling files;
  lift `useSmoothScroll` + filter state into a thin `WallsPage` wrapper.
- 🔴 `GridDistortion.tsx` — 559 lines, GLSL inline. Move shaders to a
  constants file, extract `useGridDistortionScene` lifecycle hook.
- 🟡 `GalleryModal.tsx` — 512 lines with three intertwined animation
  systems (WAAPI FLIP + CSS opacity + rAF hover). Extract `useFlipIn`,
  `useHoverZoom`.
- 🟡 `LiquidEther.jsx` — 1175 lines, single-component file (vendored from
  React Bits; upstream parity argues against splitting).

### 2. Dead / duplicate code 🔴🟡

- 🔴 `LiquidEther.jsx` — only `.jsx` in an otherwise strict TS codebase.
  See TOP 5 #4.
- 🔴 `HomeToggle.tsx`, `ParallaxSlider.tsx`, `setTransitionDirection`,
  legacy props on `AppShell` / `Burger`. See TOP 5 #3.
- 🟡 `WallsGallery.module.css` — orphan classes. See TOP 5 #3.
- 🟡 `ChainBridge.tsx:46-69` link-preload effect + `ChainBridge.tsx:188-232`
  in-DOM `preloadRack` + `Preloader.tsx:96-152` preload pass all warm
  the same URLs three times. Pick one.
- 🟡 `pageOrder.ts:25-32` `setTransitionDirection` — see above.
- 🟡 `globals.css:142-149` — multi-paragraph comment about the removed
  View Transitions API.

### 3. CSS smells 🔴🟡🟢

- 🔴 `globals.css:76` `font-family: ... !important` — only `!important` in
  the codebase; nothing competes.
- 🔴 **Z-index conflict:** `BlogMap.module.css:264` `.zoomControls z:5`
  sits **below** `EdgeNav z:7`. EdgeNav's bottom click-zone overlaps
  the +/- buttons. Lift `.zoomControls` to ≥8.
- 🔴 `Cursor.module.css:25` `z-index: 9999` is the only 4-digit value; the
  rest of the app stays under 100. Use 200 to keep the scale consistent
  (still above `WallsGallery .zoom z:100`).
- 🟡 Recipes shared between `GalleryModal.module.css` (`.modal::before/::after`,
  lines 27-49) and `WallsGallery.module.css` (`.zoom::before/::after`, lines
  693-715) — same `tile.webp` + linear-gradient overlay. Lift to a
  shared utility class.
- 🟡 Magic offsets repeated across files: `top: 200px / 160px / 140px`
  (walls filters), `top: 66px` (Logo), `bottom: 65px` (TopNav),
  `bottom: 32px` (zoom controls). Promote to CSS custom properties on
  `:root`. Also `408 × 506` (frame) and `196 × 249` (side thumb) appear
  in both `GallerySlider.module.css` and `ChainBridge.module.css`
  skeleton — single source of truth.
- 🟡 **`prefers-reduced-motion`**: only `BlogMap.module.css:400-419`
  honours it. `HomeSlider`, `GallerySlider`, `ChainBridge`, `Cursor`,
  all `Walls*` modules ignore it.
- 🟡 **No `:focus-visible` anywhere** — TOP 5 #1.
- 🟢 `globals.css:97-103` — `* { cursor: none }` then
  `a, button, body > * { cursor: none }` is redundant.
- 🟢 `GalleryModal.module.css:163,170-177` — `transition: opacity 0.3s ...`
  defined twice on `.picture` and `.pictureTracking`. Could share a base.
- 🟢 Eric Meyer reset in `globals.css:21` (35-line tag list) is overkill
  for Next 16 + modern browsers; consider a small modern reset.

### 4. React anti-patterns 🔴🟡

- 🔴 `HomeSlider.tsx:65` mutates `PAGE_VISUALS["/"].bg` — TOP 5 #2.
- 🔴 `BlogMap.tsx:635-654` `useMemo(..., [paths])` references
  `projectionRef.current` (a ref), so the memo never invalidates if the
  projection initialises after first render. Build the projection
  inside the same `useMemo` that builds `paths` and return both.
- 🔴 `BlogMap.tsx:580-595` `useEffect(... pointerdown ...)` with
  `// eslint-disable-next-line react-hooks/exhaustive-deps` — `exitFocus`
  is a fresh closure every render; the listener may capture a stale one.
  Wrap `exitFocus` in `useCallback` or move via a ref.
- 🟡 `HomeSlider.tsx:92-99` — keyboard listener `useEffect` with `[]`
  deps but calls `prev` / `next` from the component body. Works today,
  one regression away from broken.
- 🟡 `WallsGallery.tsx:268-282` — `eslint-disable` on a `useEffect` that
  calls `closeZoom`; same closure hazard as BlogMap.
- 🟡 `GalleryModal.tsx:199-212` — two `useLayoutEffect` / `useEffect`
  blocks both call `runFlipIn`, both ESLint-suppressed. Promote
  `runFlipIn` to `useCallback`.
- 🟡 `Preloader.tsx:81-157` reads `wallsData` JSON eagerly at module
  level — fine — but `buildCriticalUrls` runs on every Preloader render.
  Move outside the component or memoise.
- 🟡 `GallerySlider.tsx:117-122` `getActiveImgRect` queries the DOM by
  selector inside a render. Should be a ref to the active Swiper slide.

### 5. TypeScript 🔴🟡🟢

- 🔴 `LightRays.tsx:88-96`, `GridDistortion.tsx:170-171` — `any` on
  `uniformsRef`, `rendererRef`, `meshRef` with `eslint-disable`. Type
  properly.
- 🟡 `BlogMap.tsx:231` `worldRaw as unknown as Topology` — types are
  installed (`@types/topojson-specification`); should resolve directly.
- 🟡 `BlogMap.tsx:781-785` spread of `{xmlns: "..."}` cast as
  `Record<string, string>` to bypass JSX prop types. Use a single
  `@ts-expect-error` with a comment instead.
- 🟡 `pageOrder.ts:74-77` `(window as unknown as ChainWindow).__stukhinChainFrom`
  — augment the global `Window` interface once.
- 🟡 `Preloader.tsx:46` `(wallsData as { id: string }[])` — `resolveJsonModule`
  is already on; generate proper types via a small `.d.ts`.
- 🟢 Most exported components have no explicit return type — strict mode
  infers, but pinning to `JSX.Element` is better DX.

### 6. Performance 🔴🟡🟢

- 🔴 **Triple preload** — `ChainBridge.tsx:46-69` (`<link>`) +
  `ChainBridge.tsx:188-232` (`<img>` rack) + `Preloader.tsx:96-152` —
  all warm the same URLs. Consolidate.
- 🔴 `BlogMap.tsx:321-322` `recomputePan` writes `wrap.style.setProperty`
  twice per frame in the mousemove rAF. Combine into a single
  `style.cssText` or transform-string update — each property write
  triggers style invalidation.
- 🔴 `HomeSlider.tsx:166-172` and others duplicate `matchMedia("(...)")`
  listeners. Centralise via a `useMediaQuery` hook.
- 🟡 `useDesktopPageWheel.ts:154` is `passive: true`; `useSmoothScroll.ts:89`
  is `passive: false`. Both attach `wheel` listeners on `window` — two
  listeners per gesture, wasteful (works but noisy).
- 🟡 `WallpaperCard` (`WallsGallery.tsx:475-595`) creates `useSpring(useMotionValue(0), SPRING)`
  per card per mount × N cards. 40+ wallpapers = 120+ spring instances
  even off-screen. Virtualise or gate motion springs on
  `IntersectionObserver`.
- 🟡 `GridDistortion.tsx:411-422` nested `grid × grid` loop runs every
  frame on the main thread (18×18 = 324 ops/frame on top of the
  displacement decay). Move to a compute shader or coarser grid.
- 🟡 `BlogMap.tsx:230-277` `useMemo([])` holds the full 50m path strings
  (~250 entries) for the component's lifetime — fine but heavy.
- 🟡 `ChainBridge.tsx:188-232` off-screen `<img>` rack relies on browser
  keeping images decoded; modern browsers don't guarantee that.
  `<link rel="preload">` is the spec-blessed mechanism — drop the rack.
- 🟢 `world-atlas/countries-50m.json` (~300 KB raw / ~80 KB gzip) loads
  on every / route because BlogMap isn't dynamically imported. Wrap
  in `dynamic(() => import("@/components/BlogMap/BlogMap"), { ssr: false })`.

### 7. Accessibility 🔴🟡

- 🔴 Global `cursor: none` + missing `:focus-visible` styles =
  keyboard users have no visual focus indicator anywhere — TOP 5 #1.
- 🟡 `GalleryModal.tsx:382-385` `<div role="dialog" aria-modal>` with no
  focus trap and no return-focus on close. Same for `WallsGallery.tsx:346-349`.
- 🟡 `EdgeNav.tsx:43-60` top / bottom 30 % click zones with no visible
  affordance. Screen readers fine via `aria-label`, but invisible
  click zones break a11y heuristics.
- 🟡 `HomeSlider.tsx:197-210` `<button data-cursor="arrow-left">` "Previous
  slide" with no visible content — no keyboard focus indicator because
  of global `cursor: none`.
- 🟡 `BlogMap.tsx:878-897` zoom controls have `aria-hidden="true"` on the
  wrapping div but contain real `<button aria-label>` children.
  Conflicting — drop the outer aria-hidden.

### 8. Mobile / responsive 🟡

- 🟡 `BlogMap.module.css:82` uses `100dvh` without `100vh` fallback —
  breaks on old Safari < 15.4.
- 🟡 `useVerticalPageSwipe.ts:43` gates on `matchMedia("(hover: none)")`
  — false positives on Windows touchscreens that report both. Combine
  with `pointer: coarse`.
- 🟡 `Preloader.tsx:62-69` preloads 21 nature + 5 city JPGs unconditionally
  on mobile — ~6–12 MB on cellular before any user interaction. Gate on
  `navigator.connection.saveData`.
- 🟡 `WallsGallery.module.css:521-548` `.downloadBtn { width: 32px; height: 32px }`
  is below WCAG 44 × 44 touch target minimum.

### 9. Build / DX 🟢🔴🟡

- 🟢 `npm run build` is clean — no warnings, all 10 pages prerender.
- 🔴 `tsconfig.json:9` `"allowJs": true` exists only because of
  `LiquidEther.jsx`. Convert and disable.
- 🔴 **ESLint inline disables in 10+ places** — several mask real bugs
  (see §4): `LightRays.tsx:88,90,95`, `GridDistortion.tsx:170`,
  `BlogMap.tsx:594`, `WallsGallery.tsx:281`, `GalleryModal.tsx:201,211`,
  `HomeSlider.tsx` keyboard effect, `TopNav.tsx:147`.
- 🔴 **Bundle size**: `world-atlas/countries-50m.json` (300 KB raw),
  `three` full import in `GridDistortion.tsx:4` (`import * as THREE`
  — tree-shake-resistant), plus `swiper`, `motion`, `ogl`. Three
  WebGL libs (`three` + `ogl` used by two components) — pick one.
- 🟡 `package.json` mentions `exif-reader` + `sharp` in devDependencies
  — neither is referenced by app code. Likely leftover from a removed
  build script; prune.
- 🟡 No explicit `.eslintrc*` at repo root; `npm run lint` script
  references `next lint` which auto-discovers — verify rules are actually
  being applied.
- 🟡 Consider adding `"noUncheckedIndexedAccess": true` to `tsconfig` —
  helps with `arr[0]` patterns in `LightRays.tsx`.

### 10. Naming / docs drift 🟡

- 🟡 `Preloader.tsx:14-19` exports `HOME_INTRO_KEY` and
  `PRELOADER_DONE_EVENT`; grep shows `HomeSlider` doesn't import either.
  Stale doc / dead export.
- 🟡 `Preloader.tsx:18` JSDoc references "TV-style reveal animation" —
  `HomeSlider.tsx:36-37` says the reveal was removed.
- 🟡 `AppShell.tsx:35-36` — "Legacy — no longer affects rendering; kept
  for prop-API compat." Prop API is the eight call-sites in THIS repo;
  just remove.
- 🟡 `BlogMap.tsx:127` JSDoc says "Renders 110m country dataset" but
  line 17 imports `countries-50m.json`.
- 🟡 `ChainBridge.tsx:9` `BASE_DURATION = 800` but `system/page.tsx:73`
  motion table reports "560/720 ms". Source-of-truth diverges.

---

## What just shipped (last 12 commits)

Recent /blog focus-mode polish + skeleton-during-chain + mobile pass:

```
51701a3 Trace tint + non-scaling, mirror exit, pinch zoom, restore dot markers
953c631 Map polish round 4: motion.path trace, 50m topology, width cap, focus opacity
d18b410 Stroke trace: SMIL <animate> with fill="freeze" instead of rAF + style
75bad11 Magnifier stroke 2px to match ring; drop non-scaling-stroke on trace
f385e2f Map polish: smaller magnifier, sealed trace, Safari hit fix, focus zoom
12c1e78 Skeleton on top of bridge bg + lower opacity + match real grid
0f59236 Move skeletons into bridge slides — visible during the slide itself
b5e5050 Skeleton placeholders during chain transition on /nature, /city, /walls
1bac962 Mobile pass: gallery swipe, modal touch, walls snippet preview, info button
b8f4219 Gate bridge fade-in on explicit decode + render slide as <img>
1fe8cff Force home slide decode via link-preload + in-viewport rack
c07f149 Anchor bridge slide images in DOM to kill the residual home flash
```

Key architectural changes from these commits that drift from PROJECT.md:

- `BlogMap` now uses **50m TopoJSON** (`countries-50m.json`), not 110m.
- Country stroke trace runs through **Framer Motion's `motion.path` +
  `pathLength`** (not CSS transition, not JS rAF, not SMIL — those all
  failed for different reasons; documented in commit messages).
- `/blog` country click enters a **focus mode**: country scales to 60 %
  vh / 80 % available width, glides to centre between left edge and
  side panel (`BlogCountryModal` repurposed as right-side slide-in,
  width `clamp(360px, 60vw, 880px)`). Close: X button, Escape, or click
  outside the panel. `.mapWrap.closing` mirrors the entry's 1.4 s easing
  for the reverse animation.
- ChainBridge has a `<link rel="preload">` + persistent `<img>` rack
  (see §6 — duplicates that need consolidating).
- All chain transitions force `img.decode()` on the from-route's bg
  image BEFORE the bridge fade-in, eliminating the home-page-slide
  2/3/4 black flash.
- Walls mobile (≤597 px) renders single-column "snippet preview"
  cards with `aspect-ratio: 1080 / 384` (5× height crop), filters
  centred on tablet + mobile.
- Walls zoom modal has an always-visible info (i) + download button
  group bottom-right; info opens a metadata panel.

---

## Starting a new session

1. Read `PROJECT.md` (architecture) + this file (backlog).
2. Pick from TOP 5 or any 🔴 item.
3. Keep changes scoped — most items are independent.
4. Before touching `BlogMap` or `WallsGallery`, expect refactors to
   touch a lot of CSS — coordinate splits with a separate commit.
5. `npm run build` to verify; deploy = push to `main` (Vercel auto).
