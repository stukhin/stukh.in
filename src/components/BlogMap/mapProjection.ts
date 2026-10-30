/**
 * Map geometry for BlogMap, loaded from the build-time mapData.json.
 * Stateless — kept out of the component so it reads.
 */

import { geoEqualEarth } from "d3-geo";
import mapData from "./mapData.json";

export type CountryPath = {
  id: string;
  name: string;
  d: string;
};

export type Projection = ReturnType<typeof geoEqualEarth>;

/** [[x0, y0], [x1, y1]] in projected SVG (viewBox) units. */
export type Bounds = [[number, number], [number, number]];

export type MapProjection = {
  /** Visited countries only. */
  paths: CountryPath[];
  /** Every other country, merged — feeds the frosted-glass clip. */
  unvisitedD: string;
  viewBoxStr: string;
  mapAspect: number;
  vb: { x: number; y: number; w: number; h: number };
  projection: Projection;
  /** Bounds to frame when a country is focused — see focusBoundsOf. */
  getFocusBounds: (id: string) => Bounds | null;
};

/**
 * The map arrives precomputed (scripts/build-map.mjs, run as
 * `prebuild`): projected paths for visited countries, one merged
 * path for the rest, focus bounds, and the fitted projection's
 * scale / translate. Only the projection is rebuilt here — the
 * lat/long readout needs `invert()`.
 */
export function buildMapProjection(): MapProjection {
  const [x, y, w, h] = mapData.viewBox;
  const projection = geoEqualEarth()
    .scale(mapData.scale)
    .translate(mapData.translate as [number, number]);

  const focus = new Map(
    mapData.visited.map((c) => [c.id, c.focus as Bounds])
  );

  return {
    paths: mapData.visited.map(({ id, name, d }) => ({ id, name, d })),
    unvisitedD: mapData.unvisitedD,
    viewBoxStr: `${x} ${y} ${w} ${h}`,
    mapAspect: w / h,
    vb: { x, y, w, h },
    projection,
    getFocusBounds: (id) => focus.get(id) ?? null,
  };
}
