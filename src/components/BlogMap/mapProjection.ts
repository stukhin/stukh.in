/**
 * Pure helpers extracted from BlogMap: the d3-geo / topojson plumbing
 * that turns the world-atlas TopoJSON into projected SVG paths, plus
 * the deterministic `explodeStyleFor` vector used during focus mode.
 * Both are stateless — kept here so the React component file isn't
 * scrolling past 50 lines of cartographic glue before reaching its
 * first hook.
 */

import type { CSSProperties } from "react";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import worldRaw from "world-atlas/countries-50m.json";
import type {
  Feature,
  Geometry,
  FeatureCollection,
} from "geojson";
import type {
  Topology,
  GeometryCollection,
} from "topojson-specification";

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
  cx: number;
  cy: number;
};

export type Projection = ReturnType<typeof geoEqualEarth>;

export type MapProjection = {
  paths: CountryPath[];
  viewBoxStr: string;
  mapAspect: number;
  vb: { x: number; y: number; w: number; h: number };
  projection: Projection;
};

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * Project all country paths once. The viewBox is then tightened to
 * the projected feature bounds — no internal padding, so the
 * northernmost / southernmost lands actually touch the SVG top +
 * bottom edges. Combined with CSS height: 100% on the SVG, this is
 * what lets Antarctica's coastline sit flush with the viewport
 * bottom.
 */
export function buildMapProjection(): MapProjection {
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
    (f: CountryFeature) => {
      const d = pathGen(f) ?? "";
      // Bbox centre per country (in projected SVG coords). Used as
      // the transform origin when the visited <clipPath> pre-scales
      // to match the visual's hover scale.
      const bounds = pathGen.bounds(f);
      const cx = (bounds[0][0] + bounds[1][0]) / 2;
      const cy = (bounds[0][1] + bounds[1][1]) / 2;
      return {
        id: String(f.id ?? ""),
        name: f.properties?.name ?? "",
        d,
        cx,
        cy,
      };
    }
  );

  return {
    paths,
    viewBoxStr: `${vbX} ${vbY} ${vbW} ${vbH}`,
    mapAspect: vbW / vbH,
    vb: { x: vbX, y: vbY, w: vbW, h: vbH },
    projection,
  };
}

/**
 * Per-path explode vector. Same input → same output, so each
 * country always flies the same way every time the user enters
 * focus mode (deterministic feels intentional; truly random feels
 * jittery). Distance is in viewport pixels — large enough to clear
 * the screen even if the country starts at the far edge.
 */
export function explodeStyleFor(id: string | number): CSSProperties {
  let seed = 0;
  if (typeof id === "string") {
    for (let i = 0; i < id.length; i++) seed = seed * 31 + id.charCodeAt(i);
  } else {
    seed = id;
  }
  // Hash through a few rounds so neighbouring IDs (which are
  // adjacent country numbers in the topology) don't fly in similar
  // directions.
  seed = Math.abs((seed * 2654435761) >>> 0);
  const angle = (seed % 360) * (Math.PI / 180);
  const distance = 900 + ((seed >> 8) % 700);
  const rotation = (((seed >> 16) % 720) - 360) * 0.6;
  return {
    "--explode-x": `${Math.cos(angle) * distance}px`,
    "--explode-y": `${Math.sin(angle) * distance}px`,
    "--explode-rot": `${rotation}deg`,
  } as CSSProperties;
}
