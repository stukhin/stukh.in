/**
 * Precomputes the /blog world map.
 *
 *   node scripts/build-map.mjs
 *
 * Projects world-atlas countries-50m through a fitted Equal Earth
 * projection and writes src/components/BlogMap/mapData.json:
 *   - viewBox (tightened to the projected world bounds)
 *   - projection scale + translate (the client rebuilds the same
 *     projection for the lat/long readout without the atlas)
 *   - visited countries: SVG path, name, focus bounds
 *   - every other country merged into one path (the frosted-glass clip)
 *
 * The browser used to download the 236 KB (gz) TopoJSON and run
 * topojson + geoPath over ~240 countries on every mount. Re-run
 * only if the atlas or the fit size changes.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";

const require = createRequire(import.meta.url);
const world = JSON.parse(
  readFileSync(require.resolve("world-atlas/countries-50m.json"), "utf8")
);

// Equal Earth is ~2.05:1; 1000 × 488 keeps fitSize numbers clean.
const FIT_W = 1000;
const FIT_H = 488;
// Visited ISO codes, read straight from visits.ts (`iso: "724"`).
const visitsSrc = readFileSync(
  new URL("../src/components/BlogMap/visits.ts", import.meta.url),
  "utf8"
);
const VISITED = new Set([...visitsSrc.matchAll(/\biso:\s*"(\d+)"/g)].map((m) => m[1]));

const round = (n) => Math.round(n * 1000) / 1000;

const fc = feature(world, world.objects.countries);
const projection = geoEqualEarth().fitSize([FIT_W, FIT_H], fc);
// Bounds / areas use full precision; only the path strings round.
const pathGen = geoPath(projection);
const pathFine = geoPath(projection).digits(1);
const pathCoarse = geoPath(projection).digits(0);

/**
 * Bounds worth framing for a country: its largest polygon plus every
 * part within half that polygon's size of it. A plain bbox of the
 * MultiPolygon drags overseas territories into the frame — France's
 * spans French Guiana and Réunion, Spain's the Canaries, Portugal's
 * the Azores, Chile's Easter Island — while Corsica, the Balearics
 * or Japan's main islands still make it in.
 */
function focusBoundsOf(f) {
  if (f.geometry.type !== "MultiPolygon") return pathGen.bounds(f);
  const parts = f.geometry.coordinates.map((coordinates) => {
    const polygon = { type: "Polygon", coordinates };
    return { area: pathGen.area(polygon), b: pathGen.bounds(polygon) };
  });
  parts.sort((a, b) => b.area - a.area);
  const [[mx0, my0], [mx1, my1]] = parts[0].b;
  const pad = Math.max(mx1 - mx0, my1 - my0) / 2;
  const near = parts.filter(
    ({ b: [[x0, y0], [x1, y1]] }) =>
      x1 >= mx0 - pad && x0 <= mx1 + pad && y1 >= my0 - pad && y0 <= my1 + pad
  );
  return [
    [Math.min(...near.map((p) => p.b[0][0])), Math.min(...near.map((p) => p.b[0][1]))],
    [Math.max(...near.map((p) => p.b[1][0])), Math.max(...near.map((p) => p.b[1][1]))],
  ];
}

const wb = pathGen.bounds(fc);

// Some features share an id (Australia + Ashmore and Cartier Is. are
// both "036") or have none (Kosovo, Somaliland, …). Merge by id so
// React keys and <clipPath id>s stay unique; the first feature keeps
// the name and focus bounds (the atlas lists the main country first).
const byId = new Map();
fc.features.forEach((f, i) => {
  const id = f.id == null ? `x${i}` : String(f.id);
  const d = ((VISITED.has(id) ? pathFine : pathCoarse)(f)) ?? "";
  const prev = byId.get(id);
  if (prev) {
    prev.d += d;
    return;
  }
  byId.set(id, {
    id,
    name: f.properties?.name ?? "",
    d,
    focus: focusBoundsOf(f).map((p) => p.map(round)),
  });
});

const out = {
  viewBox: [wb[0][0], wb[0][1], wb[1][0] - wb[0][0], wb[1][1] - wb[0][1]].map(round),
  scale: projection.scale(),
  translate: projection.translate(),
  visited: [...byId.values()].filter((c) => VISITED.has(c.id)),
  unvisitedD: [...byId.values()]
    .filter((c) => !VISITED.has(c.id))
    .map((c) => c.d)
    .join(""),
};

const file = new URL("../src/components/BlogMap/mapData.json", import.meta.url);
writeFileSync(file, JSON.stringify(out));
console.log(`mapData.json: ${byId.size} countries, ${out.visited.length} visited`);
