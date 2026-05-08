/**
 * Visited countries — the data driving /blog. Each entry is keyed by
 * its ISO 3166-1 numeric code (matching the `id` field in
 * world-atlas/countries-110m.json) so the map's path renderer can
 * look the visit up directly off the geometry it just drew.
 *
 * v0 holds three sample countries (Spain, Korea, Chile) with mocked
 * dates / cities / descriptions so the hover plate and the country
 * modal both have something to display while we work out the layout.
 * Real data + photo previews land once the look is locked.
 */
export type Visit = {
  /** ISO 3166-1 numeric code as a string. */
  iso: string;
  /** Country name (lowercase, hand-edited; not derived from the
   *  TopoJSON's English label so we can keep the casing consistent
   *  with the rest of the site). */
  name: string;
  /** Free-form date / period of the trip. */
  dates: string;
  /** Cities visited, in the order they're worth listing. */
  cities: string[];
  /** Photo thumbs for the hover plate. Empty array → plate shows a
   *  "previews coming" placeholder instead. */
  thumbs: string[];
  /** Long-form paragraph for the modal. */
  description?: string;
  /** Bullet recommendations for the modal. */
  recommendations?: string[];
};

export const VISITS: Visit[] = [
  {
    iso: "724",
    name: "spain",
    dates: "september 2023",
    cities: ["barcelona", "girona", "valencia"],
    thumbs: [],
    description:
      "Coastal walks along the Costa Brava, Sant Pere de Rodes monastery at sunset, and slow days in Girona's old town.",
    recommendations: [
      "La Pubilla in Gracia for breakfast",
      "Calders bookshop in Sant Antoni",
      "Sant Pere de Rodes hike from El Port de la Selva",
    ],
  },
  {
    iso: "410",
    name: "south korea",
    dates: "april 2024",
    cities: ["seoul", "busan", "jeju"],
    thumbs: [],
    description:
      "Tea fields in Boseong, harbour mornings in Busan, hiking the volcanic ridges of Jeju.",
    recommendations: [
      "Boseong Green Tea Plantation at first light",
      "Hadong's Hwagaecheon at peak bloom",
      "Jeju Olle trail #6 from Soesokkak",
    ],
  },
  {
    iso: "152",
    name: "chile",
    dates: "december 2022",
    cities: ["santiago", "san pedro de atacama", "puerto natales"],
    thumbs: [],
    description:
      "Atacama nights with the Milky Way overhead, granite towers in Torres del Paine, fog drifting off Valparaíso's hills.",
    recommendations: [
      "Valle de la Luna at sunset",
      "El Chaltén day hike to Laguna Capri",
      "El Quitral wine bar in Bellavista",
    ],
  },
];

export const VISIT_BY_ISO = new Map(VISITS.map((v) => [v.iso, v]));
