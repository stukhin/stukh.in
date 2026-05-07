"use client";

import { useMemo } from "react";
import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import worldRaw from "world-atlas/countries-110m.json";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import styles from "./BlogMap.module.css";

/**
 * ISO 3166-1 numeric codes (matching the `id` field in
 * world-atlas/countries-110m.json) for the countries we want
 * highlighted on the map. Three sample picks for the v0 visual
 * review — once the look is locked we'll wire the full visited
 * list off /walls + a small "places I've been" extras file.
 */
const VISITED = new Set([
  "724", // Spain
  "410", // Korea, Republic of
  "152", // Chile
]);

// SVG viewBox dimensions. The d3 projection is fitted to these so
// the map fills the box edge-to-edge regardless of CSS sizing.
const WIDTH = 980;
const HEIGHT = 480;

type CountryFeature = Feature<Geometry, { name?: string }>;

/**
 * /blog world map. Renders Natural Earth's 110m country dataset
 * (≈ 80 KB TopoJSON, served via the `world-atlas` npm package) as
 * SVG paths through a d3-geo Equal Earth projection — modern
 * equal-area, doesn't blow Greenland and Antarctica out of
 * proportion the way Mercator does.
 *
 * Visited countries get a solid dark fill against a near-invisible
 * grey for the rest of the world, so the eye lands on them
 * immediately. Hover deepens to the warm accent. The under-
 * construction stamp parks in the corner — the page is a v0
 * visual review of the map only; tooltips, click-through to
 * /walls, and the proper visited list come next.
 */
export default function BlogMap() {
  const paths = useMemo(() => {
    const topology = worldRaw as unknown as Topology;
    const featureCollection = feature(
      topology,
      topology.objects.countries as GeometryCollection
    ) as FeatureCollection<Geometry, { name?: string }>;

    // Fit the projection to the viewBox so the map fills it nicely
    // with a thin margin to keep the easternmost / southernmost tips
    // off the SVG edge.
    const projection = geoEqualEarth().fitExtent(
      [
        [10, 10],
        [WIDTH - 10, HEIGHT - 10],
      ],
      featureCollection
    );
    const pathGen = geoPath(projection);

    return featureCollection.features.map((f: CountryFeature) => ({
      id: String(f.id ?? ""),
      name: f.properties?.name ?? "",
      d: pathGen(f) ?? "",
    }));
  }, []);

  return (
    <div className={styles.mapWrap}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.map}
        preserveAspectRatio="xMidYMid meet"
        aria-label="World map of visited places"
      >
        {paths.map((p) => {
          const isVisited = VISITED.has(p.id);
          return (
            <path
              key={p.id}
              d={p.d}
              className={`${styles.country} ${
                isVisited ? styles.visited : ""
              }`}
            >
              {/* Native SVG title gives a default browser tooltip on
                  hover — minimal interactivity for v0 without
                  needing a full positioned plate. */}
              <title>{p.name}</title>
            </path>
          );
        })}
      </svg>
      <div className={styles.stamp}>under construction</div>
    </div>
  );
}
