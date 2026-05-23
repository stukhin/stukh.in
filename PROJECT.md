# stukh.in — project notes

A personal photography portfolio at **stukh.in**. Single-page-feel
strip of pages connected by a chained slide animation, custom cursor
+ shell chrome, and a few WebGL set-pieces.

This file is the cold-start brief: enough to land in any part of
the codebase and know which file owns what. Component-level details
live in the JSDoc/comments at the top of each file — don't repeat
them here, link out.

---

## Stack

- **Next.js 16.2.x (App Router, Turbopack)** + **React 19.2.x**.
- **TypeScript** (strict). `.tsx` everywhere — no `allowJs` flag.
- **Swiper 11** for the horizontal photo carousels on /nature, /city.
- **motion** (Framer Motion) for the /walls grid layout animations
  and per-card tilt springs (gated on IntersectionObserver — see
  `WallpaperCard`).
- **ogl** for `LightRays` (/nature, /city). Intended as the site's
  standard WebGL stack — a first attempt at porting `GridDistortion`
  off three.js (commit `a07b551`) shipped but crashed Chrome's
  renderer on the home route and was reverted. See AUDIT.md.
- **three** for `GridDistortion` (home hero) and `LiquidEther`
  (/blog fluid sim). Both currently three.js; both candidates for
  the ogl move once the GridDistortion port is debugged.
- **d3-geo** + **topojson-client** + **world-atlas** for the /blog
  world map (50m TopoJSON).
- CSS Modules for everything; one global stylesheet at
  `src/app/globals.css` (resets + `* { cursor: none }` rule +
  `:focus-visible` ring + `--shell-fg-strong` / `--shell-fg-soft`
  theme tokens).
- Ambient types in `src/types/global.d.ts` (currently just the
  `Window.__stukhinChainFrom` augmentation).

Build: `npm run build`. Dev: `npm run dev`.

---

## Page strip

The site behaves like a vertical strip of "blocks". The order is
fixed in `src/lib/pageOrder.ts`:

```ts
export const PAGE_ORDER = ["/", "/nature", "/city", "/walls", "/blog"];
```

Routes outside the order (`/order`, `/system`, `/trips`, 404) are
treated as forward transitions and don't slide.

Two paging gestures land on the same chained-slide animation:

- **Mobile / touch:** vertical swipe (`useVerticalPageSwipe`,
  `src/lib/useVerticalPageSwipe.ts`). Threshold-only — past 22% of
  viewport height in the dominant axis, commit. NO live preview
  overlay; the gesture detection just dispatches `chainNavigate`
  and ChainBridge owns the visual. Mirrors the desktop wheel UX
  exactly. Gated on `(hover: none) AND (pointer: coarse)` so
  Windows touchscreen laptops don't get both this AND the wheel
  hook.
- **Desktop / wheel:** wheel + trackpad delta accumulates;
  `useDesktopPageWheel` (`src/lib/useDesktopPageWheel.ts`). 600 px
  threshold, 2.5 s cooldown, `passive: true`. Mounted in `AppShell`
  so every in-strip page picks it up. Reads `pathname` through a
  ref so the cooldown survives navigations (otherwise trackpad
  inertia after a nav could fire a second one). Defers to inner
  wheel handlers via `e.defaultPrevented`.

Both gestures end up calling `navigateChained()` which hands off to
`ChainBridge` (`src/components/ChainBridge`). ChainBridge paints a
stack of bg slides over the live page and runs a single continuous
`translateY` animation across them — same effect as VT API but with
the live shell DOM staying on top so its `mix-blend-mode: difference`
treatment (logo) tracks the moving page edge per pixel.

Each in-strip page has a colour + optional bg image declared in
`src/lib/pageVisuals.ts` so ChainBridge and the swipe preview share
the same "what does the next page look like" snapshot.

---

## Pages

```
/         home — full-bleed photo slider (HomeSlider)
/nature   framed-photo gallery on dark bg + LightRays (GallerySlider)
/city     framed-photo gallery on light bg                 (GallerySlider)
/walls    wallpaper grid + filter dropdowns + zoom modal   (WallsGallery)
/blog     world map of visited places                       (BlogMap)

/order    print-order info (Placeholder)
/system   internal design-system reference (typography, colours,
          spacing, breakpoints)
/trips    "coming soon" placeholder
404       not-found page
```

Layout-wise every page is wrapped in a top-level `<div>` (e.g.
`page.module.css .nature`) sized to `100dvh` with `overflow: hidden`
where it doesn't scroll natively. `/walls` is the exception — the
wallpaper grid scrolls its body.

---

## Persistent shell

`src/components/AppShell` mounts the same set of fixed-position
chrome elements on every page that uses it:

- `Logo`             top-left, mix-blend-mode: difference, drives
                     the colour boundary effect during page slides
- `Burger`           mobile / tablet menu trigger
- `MenuPopup`        full-screen menu (open: portal in body)
- `TopNav`           desktop bottom-right link list
                     (nature / city / walls / blog) with the
                     "active link's underline floats above the
                     word" indicator
- `Cursor`           single global custom cursor — variants:
                     default ring, hover dot, magnifier, picture,
                     arrow-{left,right,up,down}, grab/grabbing
                     (each via `data-cursor="..."` on hovered
                     element)
- `EdgeNav`          top + bottom click-zones for desktop
                     keyboard-light page navigation
- `useDesktopPageWheel()` (mounted from inside AppShell)

Theme tokens live as CSS variables on `<html data-theme="...">`:

```css
[data-theme="dark"]  { --shell-fg-strong: #fff; --shell-fg-soft: ... }
[data-theme="light"] { --shell-fg-strong: #000; --shell-fg-soft: ... }
```

`HomeSlider` flips `data-theme` per-slide based on average luminance
of the active photo (16×16 canvas sample, Rec. 601 weights). Other
pages set it once via `AppShell`'s `theme` / `themeScrolled` props.

---

## Page-specific notes

### Home (`/`, `HomeSlider`)

- 4-photo loop in `src/components/HomeSlider/HomeSlider.tsx` (slides
  `/images/gallery/main/desktop/{1..4}.webp`).
- Desktop: `GridDistortion` WebGL displacement effect cycling the
  photos. Mobile: plain `background-image` div fallback.
- Dot indicators at the bottom that double as a 7s slide-progress
  bar; tinted via `--shell-fg-strong/soft` so they flip dark/light
  with the slide's theme.
- Edge click-zones (`.navZone`) on the left/right 20% for prev/next.
- Vertical touch swipe → useVerticalPageSwipe; horizontal touch
  swipe between slides handled inline.

### Nature & City (`GallerySlider`)

Same component, two `category` modes. Swiper coverflow with the
active slide rendered at full size (370×470 desktop / 260×330
mobile) and others at `scale(0.53)` (or 0.73 on mobile). `.container`
transitions `transform` over 1 s — gated on a `transitionsReady`
class added ~120 ms after mount so the initial paint snaps into
position without the "left side drifts in" glitch, and clicking a
side photo gracefully zooms it into the active frame.

Non-immediate-neighbour slides on desktop are pulled toward the
centre by `(distance − 1) × 87 px` via `--slide-shift-x`, halving
the visual gap between far slides.

The active photo opens a centred modal (`GalleryModal`) via a FLIP
morph from its grid rect to its modal rect. Inside the modal, the
photo lives in a `.zoomWrap` that owns the FLIP transform (WAAPI);
the `<img>` inside owns hover-zoom (1.25×) via the **individual
`scale` + `translate` CSS properties** — separate transitions
(scale 0.9 s, translate 0.2 s) give a soft zoom enter/leave AND
snappy cursor-tracking once at full hover.

`GalleryModal` reads `hasVertical` / `hasHorizontal` props from
`src/data/galleryManifest.ts` to decide whether to render the
orientation toggle. When only one orientation has crops on disk,
the toggle group hides entirely and `GallerySlider`'s effect
auto-snaps `modalOrientation` to the available one.

### Walls (`/walls`, `WallsGallery`)

- Photo grid driven by `src/data/walls.json`. Each wallpaper has
  a category + tone, + per-id download counter persisted in
  localStorage.
- Two `FilterDropdown`s (type + colour) **fixed**-positioned at
  the top, aligned to the leftmost grid column per breakpoint.
  Frosted-glass background + SVG fractal-noise overlay
  (`<feTurbulence>`, `mix-blend-mode: overlay`). Body owns the
  wrapper's `overflow-x: hidden` which is why we use `position:
  fixed` instead of `sticky` (sticky's containing block becomes
  the overflow ancestor and never scrolls).
- Mobile is plain CSS-grid scroll, no JS magnetic snap (we tried
  the focus-on-centre / snap thing and the user rejected it).
- Hover plate (`WallpaperHoverPlate`) is desktop-only; metadata
  about the wallpaper follows the cursor on a frosted plate.
  On-card overlays were dropped — the plate carries the title /
  location / year, plus a "1080×1920 · jpg" hint when the cursor
  is over the download arrow.
- Click on a card opens `WallsGallery`'s own zoom modal
  (`.zoom`) with a FLIP morph; close arrow icon in the bottom
  right. `html.zoom-open` is set during, and shell elements have
  CSS hide rules for it.

### Blog (`/blog`, `BlogMap`)

Full-bleed world map as the page background. BlogMap is split into
`mapProjection.ts` (pure d3-geo plumbing), `CountryStroke.tsx`
(stroke-trace animator), `CountryLayer.tsx` (unvisited + visited
fill paths + hit areas), `DotLayer.tsx` (island markers), and the
React composition in `BlogMap.tsx`. The route mounts via
`src/app/blog/BlogMapClient.tsx`, a thin Client wrapper that
`dynamic()`-imports BlogMap with `ssr: false` so the 300 KB TopoJSON
+ d3-geo + ogl bundle doesn't ship until /blog is on screen.

- **Topology:** `world-atlas/countries-50m.json` (≈ 300 KB raw /
  ≈ 80 KB gzip). 50m gives clean coastlines when focus mode scales
  a country up. Tiny island nations whose 50m polygons are still
  effectively unclickable use a `coords` fallback (Seychelles,
  Maldives) — rendered as a small filled-circle marker on top of
  (or instead of) the country polygon.
- **Projection:** `geoEqualEarth().fitSize([1000, 488], features)`,
  then `pathGen.bounds(features)` tightens the SVG viewBox to the
  actual world footprint (Equal Earth's curved edges leave unused
  corners at the extremes). Projection is returned from the same
  `useMemo` that builds the path strings so dotMarkers can depend
  on it directly.
- **Sizing:** SVG is `width: calc(100dvh × var(--map-aspect))`
  + `height: 100%` + `flex-shrink: 0`, with `overflow: hidden` on
  the root. A `100vh` predecessor sits before the `100dvh` line so
  Safari < 15.4 falls back gracefully.
- **Default zoom:** 1.2×. `ZOOM_MIN: 1.0`, `ZOOM_MAX: 2.0`.
- **Pan + zoom — desktop:** cursor-position parallax (window
  mousemove → `(0..1)` along each axis → `pan = (1 − 2c) ×
  maxPanFromZoom`). Wheel + bottom-left ± buttons drive zoom; the
  ± buttons sit at `z-index: 8` to stay above EdgeNav (z 7).
- **Pan + zoom — touch:** completely separate path gated on
  `(hover: none)`. One-finger drag = delta-based pan (NOT
  parallax — the map follows the finger), two-finger pinch = zoom
  with ratio tracking. 6 px tap slop so a tap-with-jitter still
  resolves to `onClick`. `touch-action: none` on the `/blog`
  wrapper kills iOS rubber-band scroll so the map doesn't fight
  the OS for the gesture. Listeners attach to `window` (not the
  map wrap) because `pointer-events: none` on the map root means
  cream-paper touches wouldn't bubble through a wrap-scoped
  listener.
- **Visited countries:** in `src/components/BlogMap/visits.ts`,
  keyed by ISO 3166-1 numeric. Each carries flag emoji, dates,
  cities, description, recommendations, optional `coords`
  fallback. Currently 11 entries.
- **Stroke trace:** when hovering or selecting a visited country,
  a 1px cream-coloured outline draws around its perimeter over
  1.5 s. Implemented in `CountryStroke.tsx` via imperative WAAPI:
  `path.getTotalLength()` once at mount, `stroke-dasharray` =
  total, animate `stroke-dashoffset` from total → 0 via
  `Element.animate()`. SVG resets the dash pattern at every
  subpath start, and no individual subpath is longer than total,
  so all subpaths fully draw at offset 0 — survives multi-subpath
  countries (USA + Alaska, Greece + islands). Four earlier
  approaches (CSS transition on dashoffset, rAF + inline-style,
  SMIL `<animate>`, Framer Motion's `motion.path`) each regressed
  on different geometries.
- **Hover (desktop):** fill goes `#1a1a1a → #c14a3a` (no scale
  change — the stroke trace carries the hover affordance instead),
  and a `LiquidEther` fluid sim renders inside the country via
  `<foreignObject>` wrapped in a `<g clip-path="url(#country-
  clip-XXX)">` — direct clip-path on a foreignObject + WebGL
  canvas was unreliable cross-browser, the wrapping `<g>` is the
  documented fix. The hovered country path is reordered LAST in
  the visited list so it paints on top of any clustered
  neighbours.
- **Cursor follow:** a `BlogCountryPlate` (frosted dark plate
  with country name + flag, dates, cities, three 3:4 thumb
  slots) pinned to the cursor while hovered.
- **Click — desktop:** enters **focus mode**. The map glides over
  1.4 s so the selected country fills ~60 % vh, ≤ 80 % of the
  width remaining to the left of the right-side detail panel.
  The rest of the world fades to a faint neutral gray + explodes
  outward (per-path `--explode-{x,y,rot}` deterministic vector,
  hashed from the country ID so each one always flies the same
  way). `BlogCountryModal` slides in from the right at
  `clamp(360px, 60vw, 880px)`. Close: X button, Escape, or click
  outside the panel.
- **Tap — mobile:** skips the focus-mode glide entirely (the
  modal covers the whole screen on touch — centring the country
  in non-existent empty space is pointless). `BlogCountryModal`
  switches to a bottom-up full-screen variant on `≤ 597 px`.
- **Lat/long readout:** small fixed div anchored to the cursor
  (desktop only); formatted as `40°25′N    3°42′W`. Works by
  inverting `svg.getScreenCTM()` then `projection.invert([x, y])`.
  Hidden when the inverse falls outside the projected world OR
  when a country is hovered / in focus mode.
- **Page status:** "UNDER CONSTRUCTION" stamp pinned in the
  centre of the page.

---

## Custom cursor

`src/components/Cursor/Cursor.tsx` is a single fixed-position div
that follows the pointer via `--cursor-x` / `--cursor-y` CSS
variables → `translate3d` (GPU compositor layer; setting `top` /
`left` lagged under load with mix-blend on the logo).

The shape is determined by walking up from `e.target` to the first
ancestor with a `data-cursor="..."` attribute and matching against
known shapes:

```
default   16×16 outlined ring
hover     6×6  filled dot (interactive elements)
arrow-*   10×10 arrowhead (rotated via --cursor-rot)
picture   28×28 SVG image-icon mask
magnifier 32×32 SVG magnifier mask (used over /walls cards
                AND visited countries on /blog)
grab      ring (same as default — used on the gallery slider thumb)
grabbing  filled disc (during slider drag)
```

`globals.css` has a global `* { cursor: none }` rule — every
element on the site hides the OS cursor; the custom div is the
only cursor visible.

---

## Page transitions (`ChainBridge`)

`src/components/ChainBridge` listens for a `stukhin:chain-nav`
custom event dispatched from `navigateChained`. The event carries
`from` / `to` paths; the bridge:

1. Computes the slide chain (forward/backward) through PAGE_ORDER.
2. Fades in a stacked overlay of bg layers (one per page in the
   chain), fully covering the viewport.
3. Animates the stack with a single `translateY` over a duration
   that scales with the number of hops (~560–720 ms each).
4. Fires `router.push(to)` partway through so the destination
   page renders behind the still-animating stack.
5. Fades the stack back out as the new page lands.

`html.chain-active` / `html.chain-settling` classes drive a few
shell-specific overrides (logo glide colour, etc.).

`src/lib/pageVisuals.ts` is the single source of truth for the
slide colours / bg images:

```ts
"/blog":  { color: "#f5f4f1" }   // matches the live blog bg
"/walls": { color: "#0a0a0c" }
"/city":  { bg: ".../bg_city.webp",   color: "#3a3a3a" }
"/nature":{ bg: ".../bg_nature.webp", color: "#151616" }
"/":      { bg: ".../main/desktop/1.webp", color: "#0d1117" }
```

Mismatch between the slide colour and the live page produced a
visible flash at hand-off (we hit this on /blog when the slide
was dark and the live page was cream); always keep them aligned.

---

## Preloader

`src/components/Preloader` is mounted in the **root layout** so
it runs on the first hard load of any route, not just `/`.
Loads a curated list of critical images, ticks a percentage above
a 1px-thick progress bar, fades out (400 ms). Subsequent in-tab
visits are skipped via `sessionStorage["stukhin.home.intro"]`. The
`stukhin:preloader-done` event used to fire here when an in-progress
TV-reveal animation listened for it; that animation was removed,
the event has no subscribers, and the dispatch was dropped too.

The percentage and bar share a `flex-direction: column` wrapper so
the percent text always sits flush with the bar's right edge,
regardless of where the bar lands on the viewport.

There's NO custom "TV reveal" entrance for /home anymore — the
preloader's white fade-out alone reveals the photo, which is the
calmest possible entrance.

---

## Conventions

- **Custom cursor** is the only cursor on the site. New
  interactive elements pick up the right shape by adding
  `data-cursor="..."` (see Cursor.tsx for the recognised values).
- **CSS Modules** for components; one global stylesheet
  (`globals.css`) for resets + cursor: none + theme variables.
  Don't add new global rules unless they're truly site-wide.
- **TypeScript strict.** Refs use specific element types
  (`useRef<HTMLDivElement>`); no `any` outside vendored code.
- **Vendored React Bits components** were brought in-tree and
  rewritten to match the rest of the codebase: `LiquidEther` is
  `.tsx` with typed uniforms, `GridDistortion` is split between
  the renderer (`GridDistortion.tsx`) and shader source +
  uniforms type (`gridShaders.ts`). Both still run on three.js
  for now; AUDIT.md tracks the ogl port for both. Don't refer
  back to upstream parity — these are first-class site components.
- **Animations** prefer GPU-friendly properties (`transform`,
  `opacity`). For the few places we use the **individual
  transform properties** (`scale`, `translate`, `rotate`), each
  axis can carry its own transition — handy for hover-zoom where
  scale wants a long ease and translate wants a short one
  (GalleryModal `.picture`).
- **Imperative DOM updates** for high-frequency state (cursor
  position, parallax, hover zoom). React state is too slow at
  60 fps; CSS variables / inline style writes are cheap. Use rAF
  to coalesce per-frame.
- **Dark vs light pages** alternate through PAGE_ORDER (home dark
  → nature dark → city light → walls dark → blog light). Slide
  colours in pageVisuals.ts must match.
- **Leave-debounce** on hover state (80 ms) on /blog countries —
  cursor wobble at the edge would otherwise strobe the country
  visual. Pattern is reusable.

---

## Known footguns

- **`overflow-x: hidden` on a wrapper** turns it into the sticky
  containing block, which breaks `position: sticky` on inner
  elements. We hit this on /walls — the filter row is `position:
  fixed` for that reason. If something inside a walls-like
  wrapper needs to stick, fix it via `position: fixed` not by
  removing the overflow.
- **`<foreignObject>` + WebGL canvas + clip-path** is unreliable
  in Chromium / WebKit. Apply the clip on a parent `<g>` instead
  (BlogMap's LiquidEther integration).
- **CSS transitions on `transform` for cursor-following content**
  produce visible jitter at 60 fps because each mousemove starts
  a new tween that hasn't finished yet. Use rAF batching + no
  transform transition (or split into individual scale/translate
  with separate transitions) — see GalleryModal `.picture`.
- **Swiper's slide enter animation** runs once on init: every
  slide animates from transform identity to its scaled target
  over the `.container`'s transform transition. Without gating
  the transition behind a post-mount class (GallerySlider's
  `.transitionsReady`) the user sees the left-side slides
  "drift in" each load.
- **GridDistortion's data texture** initialised with random
  offsets produces a chaotic "scrambled tiles" first frame.
  Always zero-init.
- **TopoJSON detail vs hit-targets.** The site uses 50m for clean
  coastlines under focus-mode zoom, but tiny island nations
  (Seychelles, Maldives) are still effectively unclickable at
  default zoom. For those, set `coords` on the `Visit` record and
  the map renders a dot marker on top with a generous hit
  circle.

---

## Where to look first

| If you want to … | Open … |
|---|---|
| change the page strip order | `src/lib/pageOrder.ts`, `src/lib/pageVisuals.ts` |
| change a page's bg colour during slide | `src/lib/pageVisuals.ts` |
| read a media query in a component | `src/lib/useMediaQuery.ts` (`MQ.TOUCH` / `MQ.REDUCED_MOTION` / `MQ.DESKTOP_WIDE`) |
| add a cursor variant | `src/components/Cursor/Cursor.tsx` + `Cursor.module.css` |
| tweak the chained slide motion | `src/components/ChainBridge/` |
| add a Walls filter / dropdown | `src/components/WallsGallery/WallsGallery.tsx` (`FilterDropdown` sibling) |
| add wallpapers / orientations | `src/data/walls.json`, `src/data/galleryManifest.ts` |
| add a visited country | `src/components/BlogMap/visits.ts` (use `coords` if the silhouette is too small to grab) |
| change a country fill / hover / focus | `src/components/BlogMap/CountryLayer.tsx` + `BlogMap.module.css` |
| change site-wide theme tokens | `src/app/globals.css` (the `[data-theme]` blocks) |
| tweak the preloader gate | `src/components/Preloader/Preloader.tsx` (`HOME_INTRO_KEY`) |
| augment `window` typing | `src/types/global.d.ts` |

---

## Conventions for working in this repo

- Always run `npm run build` before committing — TypeScript and
  Next.js catch enough on the way that this is the cheapest
  smoke test.
- Commit messages: short title (≤ 70 chars), then a body
  paragraph per chunk of work. End with the
  `Co-Authored-By: Claude ...` line that the existing history
  uses.
- Push to `main` after every coherent batch — the deploy is on
  Vercel auto-build from `main`.
