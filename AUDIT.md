# stukh.in — backlog / tech-debt

Refreshed 2026-10-07 after a whole-site review focused on mobile
(see "Mobile review — Oct 7" under What shipped, and the new items
under What's actually open). `npm run build` is clean, all 10 routes
prerender.

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

1. **Checkout:** work directly in the main checkout
   `/Users/alexnderstyukhin/Projects/stukh.in` on `main` (the old
   `claude/dazzling-swartz-cbfece` worktree is history). Other
   sessions may push to `main` too — `git fetch` / `pull --rebase`
   before pushing.
2. **Read order:** `PROJECT.md` (architecture, page-by-page notes,
   conventions, known footguns) → this file (open backlog + lessons
   from past attempts) → only then start coding.
3. **Pick from "What's actually open" below.** Nothing 🔴 left;
   grab a 🟡 / 🟢.
4. **Deploy:** `git push origin main`; Vercel auto-deploys from
   `main`. The user prefers terse Russian, brief English in code
   comments. Once build is clean, commit + push without asking.
5. **Visual / WebGL changes need runtime verification.** `npm run
   build` doesn't catch runtime WebGL failures or browser-specific
   rendering. `npm run build` + the `stukhin-prod` launch config
   (`next start`) gives a faithful local prod; keep screenshots
   scaled down. **Check Safari separately** — the iOS Simulator
   (`xcrun simctl boot …`, then open `http://localhost:3000`) is on
   this Mac and caught two bugs Chromium never shows (see lessons).

### Lessons from the Oct 7 review (read before touching blur / SVG)
- **Never hand-write `-webkit-backdrop-filter`.** Next's CSS
  pipeline (LightningCSS) collapses `backdrop-filter: X;
  -webkit-backdrop-filter: X;` into the prefixed form only, so
  Chrome / Android / Firefox got no blur on 14 surfaces for months.
  Write the unprefixed property alone; the build adds the prefix.
  Check the built CSS: every `backdrop-filter:` should be paired.
- **Backdrop root.** An ANCESTOR with `clip-path`, `opacity < 1`,
  `filter`, `mask` or `mix-blend-mode` isolates a child's
  `backdrop-filter` (Chromium blurs an empty backdrop = no blur).
  Put clip / fade on the blurred element itself.
- **No composited HTML inside `<foreignObject>`.** WebKit draws it
  without the SVG's viewBox scaling (bug 23113): the /blog frosted
  layer smeared blur over the whole map on iPhones. Lay HTML over
  the SVG as a sibling and clip it with an `objectBoundingBox`
  clipPath instead. The LiquidEther hover layer still uses a
  foreignObject — fine on touch (skipped there), unverified in
  desktop Safari.

---

## What's actually open

### 🟡 Needs a real-device pass
- Safari / iOS: LiquidEther's half-float path, pinch-zoom now enabled,
  per-route root bg in landscape (safe-area bars), pre-hydration
  preloader gate. Chromium only so far.
- Home warp feel after the GridDistortion ogl port (same maths; the
  earlier failed port was rejected for feeling laggy) — try it by hand.
  WebGL1 path and the `onError` CSS fallback not forced in a test.
- iPad: focus glide is now on for touch tablets — check the 60vw
  panel framing and rotation re-focus on a real device.

### 🟢 Readability, no bug
- GalleryModal (~590 lines) still hosts three animation systems
  (FLIP entrance, backdrop fade, hover-zoom) — split into hooks.
- `tile.webp` modal backdrop recipe duplicated in GalleryModal and
  WallsGallery (8 lines, a `::before` — composes can't share it).
- Magic pixel offsets (walls filters top, Logo 66px, TopNav 65px,
  zoom controls 32px) → `:root` custom properties.
- `noUncheckedIndexedAccess`, explicit return types, smaller reset,
  `useMediaQuery` AbortController.
- BlogMap touch listeners are non-passive on `window` while the panel
  is open (handlers return early; latency negligible in practice).
- 4 of 25 nature entries unused (page slices to 21);
  `public/images/gallery/nature/zoomed/` (2.5 MB) unreferenced.

---

## What shipped

Grouped by area, newest-first within each group. Commits are at
`https://github.com/stukhin/stukh.in/commit/<sha>`.

**`three` removed (Oct 30)**
- ✅ GridDistortion on ogl: colour (no conversion, flipY on) and
  orientation pixel-checked against the source webps; home warp
  chunk 130 → 19 KB gz. `three` / `@types/three` uninstalled — the
  whole WebGL stack is ogl now.

**Backlog close-out (Oct 30, second batch)**
- ✅ LiquidEther on ogl (`5cde0f3`): hover no longer pulls three
  (−126 KB gz), full dispose, safe partial-init teardown.
- ✅ /blog map precomputed at build (`scripts/build-map.mjs`, runs as
  `prebuild`): 236 → 118 KB gz, no topojson / geoPath on mount;
  duplicate atlas ids merged. Prints use 720px `_md.webp`.
- ✅ Pan sync map ↔ Grainient via `lib/panBus` (no per-frame custom
  property on `<html>`).
- ✅ Keyboard: countries are Tab stops (Enter opens), panel takes and
  returns focus, filter dropdown arrows / Escape / tab-out.
- ✅ Walls: popLayout gets the card ref, cards memoised, zoom effect
  no longer re-runs mid-close.
- ✅ Home warp relaxes under a resting cursor and skips idle frames.
- ✅ Preloader hidden pre-hydration on repeat visits / no JS.
- ✅ User decisions: pinch-zoom on; root bg per route; /order logo
  scrolls; text sizes on the ramp (icons + display numerals exempt);
  touch-tablet focus glide + refocus on resize; frosted glass 32 %.

**Full audit pass (Oct 30)**
- ✅ Fonts via `next/font` (self-hosted, `--font-rubik` / `--font-inter`).
- ✅ three.js lazy: GridDistortion via `next/dynamic` (home JS 339 → 207 KB
  gz), LiquidEther warmed on desktop only; WebGL failure on home falls
  back to the CSS photo instead of crashing the page.
- ✅ Chain nav: one slide at a time (`chain-pending` guard); Cmd/Ctrl/
  middle-click open new tabs again (TopNav, Logo, Menu).
- ✅ EdgeNav off on /walls (bands sat over cards).
- ✅ Idle loops stopped: ClickSpark, /order Parallax; LightRays skips
  frames under the zoom modal, honours reduced motion, no double
  renderer on fast remount.
- ✅ Preloader no longer gates on 67 walls thumbs (moved to background);
  city 06/07 warmed.
- ✅ Gallery: Swiper keyboard off (arrows changed the slide behind the
  modal), stable modal callbacks, slider focusable + valuetext.
- ✅ /walls: storage + download hardened, hover plate off on touch.
- ✅ Stack `onTap` (cancelled drag no longer sends a print back); BlogMap
  keeps zoom when `(hover:none)` flips; ChainBridge on `dvh`.
- ✅ /order: own `<title>`, scroll links are real `<button>`s.
- ✅ Data: Latin "x" in print sizes, "Kyrgyzstan"; dropped unused
  `next-view-transitions` + `public/fonts`.

**Review follow-ups (Oct 7, user decisions)**
- ✅ Letter-spacing folded into the 3-value scale site-wide
  (0 body · -0.02em display ≥ 20px · 0.08em uppercase); `/system`
  documents it.
- ✅ Home shows the portrait hero crops on portrait screens (page,
  transition slide and preloads); phones no longer fetch the
  2000×1500 landscape files.
- ✅ /order: light shell from the top (logo + desktop nav were white
  on the pale hero), links in shell ink instead of `#06f`, bigger
  tap targets. /city + /nature location line 0.25 → 0.7 opacity.
- ✅ Removed `public/mom-vacation/` (expired hotel quiz).

**Mobile review (Oct 7)** — every route at 375×812, plus Chromium
desktop and the iOS Simulator (Safari).
- ✅ Blur everywhere: dropped the hand-written `-webkit-backdrop-
  filter` lines (14 surfaces had no blur outside Safari).
- ✅ /blog frosted countries: HTML layer over the SVG (was a
  foreignObject — blurred the whole map on iPhones, no blur in
  Chrome); one merged clip path (no seam lines).
- ✅ /blog Grainient: pan applied in the shader on a viewport-sized
  canvas (was 2.2×2.2 the screen, and phones panned past its edge);
  pauses while the full-screen panel covers it; WebGL failures fall
  back instead of crashing.
- ✅ /blog map: wheel zooms anywhere (was visited countries only,
  elsewhere it paged to /walls); +/− on touch no longer recentres;
  focus frames the mainland (France / Spain / Portugal / Chile
  dragged in overseas territories), caps tiny countries, Seychelles
  focuses at 4× (was ~340×); re-focus during the close glide works;
  hover plate flips at screen edges; no LiquidEther on touch.
- ✅ Country panel: burger + phone logo hidden while open; taste
  map as a real 2×2 grid; Stack prints sized by aspect with room
  for the fan; cover counts pinned to the bottom; bigger touch
  targets; stable card tilt and order.
- ✅ Navigation: swipe / wheel can't page under the photo zoom, the
  menu, the panel, the preloader or mid-transition; no
  pull-to-refresh on swipe pages; home slide dots clickable on
  desktop (EdgeNav sat on top).
- ✅ Shell: menu popup no longer flashes on page mounts; preloader
  logo visible, 6s cap, storage errors survivable; native cursor
  in narrow windows and on /system; landscape menu fits; 404 theme.
- ✅ Walls: zoom box follows 9:16 on narrow phones (no letterbox
  bands, buttons on the photo); zoom modals focus the dialog, not
  the first button (iOS drew a focus ring on every open).

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
