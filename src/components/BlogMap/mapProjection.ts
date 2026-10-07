/**
 * Pure helpers extracted from BlogMap: the d3-geo / topojson plumbing
 * that turns the world-atlas TopoJSON into projected SVG paths. State-
 * less — kept here so the React component file isn't scrolling past
 * 50 lines of cartographic glue before reaching its first hook.
 */

import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import worldRaw from "world-atlas/countries-50m.json";
import type {
  Feature,
  Geometry,
  FeatureCollection,
} from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";

// SVG viewBox dimensions used to fit the projection. Equal Earth
// has an intrinsic ratio of ~2.05; we pick 1000 × 488 so fitSize
// produces clean numbers. The viewBox we actually render with is
// recomputed from the projected feature bounds after fitting, so the
// map fills the SVG edge-to-edge with no internal margin.
const FIT_W = 1000;
const FIT_H = 488;

export type CountryPath = {
  id: string;
  name: string;
  d: string;
};

export type Projection = ReturnType<typeof geoEqualEarth>;

/** [[x0, y0], [x1, y1]] in projected SVG (viewBox) units. */
export type Bounds = [[number, number], [number, number]];

export type MapProjection = {
  paths: CountryPath[];
  viewBoxStr: string;
  mapAspect: number;
  vb: { x: number; y: number; w: number; h: number };
  projection: Projection;
  /** Bounds to frame when a country is focused — see focusBoundsOf. */
  getFocusBounds: (id: string) => Bounds | null;
};

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * Bounds worth framing for a country: its largest polygon plus every
 * part within half that polygon's size of it. A plain bbox of the
 * MultiPolygon drags overseas territories into the frame — France's
 * spans French Guiana and Réunion (focus centred on the Sahara),
 * Spain's the Canaries, Portugal's the Azores, Chile's Easter Island
 * — while Corsica, the Balearics or Japan's main islands still make
 * it in.
 */
function focusBoundsOf(
  f: CountryFeature,
  pathGen: ReturnType<typeof geoPath>
): Bounds {
  if (f.geometry.type !== "MultiPolygon") return pathGen.bounds(f);
  const parts = f.geometry.coordinates.map((coordinates) => {
    const polygon = { type: "Polygon" as const, coordinates };
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
    [
      Math.min(...near.map((p) => p.b[0][0])),
      Math.min(...near.map((p) => p.b[0][1])),
    ],
    [
      Math.max(...near.map((p) => p.b[1][0])),
      Math.max(...near.map((p) => p.b[1][1])),
    ],
  ];
}

/**
 * Project all country paths once. The viewBox is then tightened to
 * the projected feature bounds — no internal padding, so the
 * northernmost / southernmost lands actually touch the SVG top +
 * bottom edges. Combined with CSS height: 100% on the SVG, this is
 * what lets Antarctica's coastline sit flush with the viewport
 * bottom.
 */
export function buildMapProjection(): MapProjection {
  // `resolveJsonModule` infers the JSON literal type for worldRaw,
  // which is far narrower than the `Topology` shape `feature()`
  // expects (notably `type: string` instead of `type: "Topology"`).
  // The double-cast localised here is intentional — module-level
  // `declare module "world-atlas/*.json"` doesn't override the
  // inferred type when the JSON is co-resolved by tsc.
  const topology = worldRaw as unknown as Topology;
  const featureCollection = feature(
    topology,
    topology.objects.countries as GeometryCollection
  ) as FeatureCollection<Geometry, { name?: string }>;

  const projection = geoEqualEarth().fitSize(
    [FIT_W, FIT_H],
    featureCollection
  );
  const pathGen = geoPath(projection);

  // True bounds of the projected world — fitSize gives us the
  // requested rect, but rounded edges of Equal Earth at extreme
  // latitudes leave a sliver of unused space inside that rect, so
  // we crop the viewBox down to the actual feature footprint.
  const wb = pathGen.bounds(featureCollection);
  const vbX = wb[0][0];
  const vbY = wb[0][1];
  const vbW = wb[1][0] - wb[0][0];
  const vbH = wb[1][1] - wb[0][1];

  const paths: CountryPath[] = featureCollection.features.map(
    (f: CountryFeature) => ({
      id: String(f.id ?? ""),
      name: f.properties?.name ?? "",
      d: pathGen(f) ?? "",
    })
  );

  // Focus bounds are only ever needed for the clicked country, so
  // compute them on demand instead of for all ~240 features up front.
  const focusCache = new Map<string, Bounds | null>();
  const getFocusBounds = (id: string) => {
    if (!focusCache.has(id)) {
      const f = featureCollection.features.find(
        (feat) => String(feat.id ?? "") === id
      );
      focusCache.set(id, f ? focusBoundsOf(f, pathGen) : null);
    }
    return focusCache.get(id) ?? null;
  };

  return {
    paths,
    viewBoxStr: `${vbX} ${vbY} ${vbW} ${vbH}`,
    mapAspect: vbW / vbH,
    vb: { x: vbX, y: vbY, w: vbW, h: vbH },
    projection,
    getFocusBounds,
  };
}

