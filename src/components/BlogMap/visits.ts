/**
 * Visited countries — the data driving /blog. Each entry is keyed by
 * its ISO 3166-1 numeric code (matching the `id` field in
 * world-atlas/countries-50m.json) so the map's path renderer can
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
  /** Country flag emoji. Hand-coded so it doesn't depend on
   *  alpha-2 lookup at render time. */
  flag: string;
  /** Free-form date / period of the trip. */
  dates: string;
  /** Cities visited, in the order they're worth listing. */
  cities: string[];
  /** Photo thumbs for the hover plate (3 are shown — empty slots
   *  render as quiet placeholders until real photos are wired up). */
  thumbs: string[];
  /** Long-form paragraph for the modal. */
  description?: string;
  /** Bullet recommendations for the modal. */
  recommendations?: string[];
  /** Fallback geographic coordinates [lon, lat] for tiny visits
   *  where the country's TopoJSON silhouette is too small to grab
   *  with a cursor even at the 50m resolution (Seychelles, Maldives,
   *  etc.). When set, the map renders this visit as a small dot
   *  overlay on top of (or instead of) the country polygon — same
   *  hover plate / click-to-modal behaviour. */
  coords?: [number, number];
};

export const VISITS: Visit[] = [
  {
    iso: "724",
    name: "spain",
    flag: "🇪🇸",
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
    iso: "620",
    name: "portugal",
    flag: "🇵🇹",
    dates: "october 2018",
    cities: ["lisbon", "porto", "sintra"],
    thumbs: [],
    description:
      "Atlantic layers off the Algarve at first light, tile-clad streets in Alfama, and slow evenings on Porto's riverfront.",
    recommendations: [
      "Adraga beach pre-dawn",
      "Livraria Lello in Porto",
      "Tram 28 end-to-end in Lisbon",
    ],
  },
  {
    iso: "826",
    name: "united kingdom",
    flag: "🇬🇧",
    dates: "march 2019",
    cities: ["london", "edinburgh", "isle of skye"],
    thumbs: [],
    description:
      "Misty mornings on Skye's Quiraing, gallery hopping in London, and Edinburgh's Old Town through low spring fog.",
    recommendations: [
      "Quiraing loop on Skye",
      "Tate Modern's top-floor view",
      "Arthur's Seat at sunrise",
    ],
  },
  {
    iso: "250",
    name: "france",
    flag: "🇫🇷",
    dates: "june 2022",
    cities: ["paris", "annecy", "chamonix"],
    thumbs: [],
    description:
      "Alpine dawns in Chamonix, lakeside afternoons in Annecy, late-night walks along the Seine.",
    recommendations: [
      "Aiguille du Midi cable car",
      "Annecy old town canals",
      "Shakespeare and Company at dusk",
    ],
  },
  {
    iso: "392",
    name: "japan",
    flag: "🇯🇵",
    dates: "april 2023",
    cities: ["tokyo", "kyoto", "kanazawa"],
    thumbs: [],
    description:
      "Cherry blossoms in Maruyama Park, neon back-alleys of Shinjuku, slow tea afternoons in Kanazawa.",
    recommendations: [
      "Fushimi Inari before sunrise",
      "Omoide Yokocho for ramen",
      "Kenrokuen garden in early bloom",
    ],
  },
  {
    iso: "156",
    name: "china",
    flag: "🇨🇳",
    dates: "may 2017",
    cities: ["beijing", "shanghai", "zhangjiajie"],
    thumbs: [],
    description:
      "Sandstone pillars rising out of mist in Zhangjiajie, scale of the Forbidden City, Shanghai skyline at blue hour.",
    recommendations: [
      "Tianzi Mountain at first light",
      "798 Art Zone in Beijing",
      "The Bund from a Pudong rooftop",
    ],
  },
  {
    iso: "360",
    name: "indonesia",
    flag: "🇮🇩",
    dates: "july 2019",
    cities: ["bali", "lombok", "flores"],
    thumbs: [],
    description:
      "Disturbance — the Bali coastline at golden hour, terraced rice fields above Ubud, Komodo's pink sand beach.",
    recommendations: [
      "Tegallalang rice terraces at dawn",
      "Padar Island sunrise hike",
      "Tanah Lot at low tide",
    ],
  },
  {
    iso: "076",
    name: "brazil",
    flag: "🇧🇷",
    dates: "january 2020",
    cities: ["rio de janeiro", "paraty", "ouro preto"],
    thumbs: [],
    description:
      "Ipanema mornings, colonial streets of Paraty, and the granite spires of Tijuca in heavy summer light.",
    recommendations: [
      "Pedra Bonita hike",
      "Centro de Paraty after the rain",
      "Confeitaria Colombo, top floor",
    ],
  },
  {
    iso: "690",
    name: "seychelles",
    flag: "🇸🇨",
    dates: "february 2024",
    cities: ["mahé", "praslin", "la digue"],
    thumbs: [],
    description:
      "Granite boulders and shallow turquoise on Anse Source d'Argent, Vallée de Mai's primeval palms, slow days off-grid.",
    recommendations: [
      "Anse Source d'Argent at low tide",
      "Vallée de Mai morning walk",
      "Bicycle La Digue end to end",
    ],
    /* Seychelles has a polygon in the 50m TopoJSON but the islands
       are so tiny on a world map that the silhouette is essentially
       unclickable. Marker dot at the archipelago's approximate
       centre (Mahé, ≈ 55.45 °E / -4.68 °N) gives a real hit target. */
    coords: [55.45, -4.68],
  },
  {
    iso: "410",
    name: "south korea",
    flag: "🇰🇷",
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
    flag: "🇨🇱",
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
