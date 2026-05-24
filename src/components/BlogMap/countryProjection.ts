/**
 * Per-country projection helper used by the notebook's Map spread.
 * The world map already loads the 50m TopoJSON via mapProjection.ts;
 * this re-uses the same import (so Next's module dedup means no extra
 * cost) and produces a single fitted path + a pin projector for one
 * country at a time.
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

type CountryFeature = Feature<Geometry, { name?: string }>;

export type CountryProjection = {
  /** SVG path `d` for the country silhouette, fitted to (w × h). */
  d: string;
  /** Project a [lon, lat] pair into the same SVG coordinate space. */
  project: (coords: [number, number]) => [number, number];
};

/**
 * Build a single-country projection fitted to a (w × h) rect with a
 * small interior padding so the silhouette doesn't kiss the edges.
 * Returns null if the ISO doesn't match a feature in the topology.
 */
export function buildCountryProjection(
  iso: string,
  w: number,
  h: number
): CountryProjection | null {
  const topology = worldRaw as unknown as Topology;
  const featureCollection = feature(
    topology,
    topology.objects.countries as GeometryCollection
  ) as FeatureCollection<Geometry, { name?: string }>;

  const country = featureCollection.features.find(
    (f: CountryFeature) => String(f.id ?? "") === iso
  );
  if (!country) return null;

  // 24px padding inside the rect — gives pins on coastal cities
  // room to land without clipping their hit halo.
  const pad = 24;
  const projection = geoEqualEarth().fitExtent(
    [
      [pad, pad],
      [w - pad, h - pad],
    ],
    country
  );
  const pathGen = geoPath(projection);
  const d = pathGen(country) ?? "";

  const project = (coords: [number, number]): [number, number] => {
    const p = projection(coords);
    return p ? [p[0], p[1]] : [0, 0];
  };

  return { d, project };
}
