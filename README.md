# stukh.in

Personal portfolio site of landscape photographer **Sasha Stukhin**.

Live: [stukh.in](https://stukh.in)

## Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- CSS Modules
- Swiper 11 for galleries
- Rubik via Google Fonts

## Local development

```bash
npm install
npm run dev    # http://localhost:3000
```

## Build

```bash
npm run build
npm run start  # production server on :3000
```

## Routes

- `/` — home with a fading landscape slider
- `/nature` — dark-theme framed gallery
- `/city` — light-theme framed gallery
- `/order` — parallax mountains hero + prints/shoot/touch sections
- 404 — themed not-found page

See [`HANDOFF.md`](./HANDOFF.md) for component-by-component implementation notes.

## Deployment

Auto-deploys to Vercel on push to `main`. Branches get preview URLs.
