/**
 * Visited countries — the data driving /blog. Each entry is keyed by
 * its ISO 3166-1 numeric code (matching the `id` field in
 * world-atlas/countries-50m.json) so the map's path renderer can
 * look the visit up directly off the geometry it just drew.
 *
 * Country panel = the "field notebook" (BlogCountryModal), a
 * horizontally-paged spread instead of a vertical dossier:
 *   1. cover  — typography + visa stamp
 *   2. sheet  — contact-sheet film strip from `photos`
 *   3. taste  — `recommendations` plotted on a 4-quadrant flavour
 *               grid by `category`
 *   4. map    — country silhouette with city pins from `cityPins`
 *   5. notes  — `dispatch` micro-entries, handwritten
 *
 * Each notebook field is optional — countries with only the legacy
 * shape (description + cities + plain string recs) still render
 * cleanly, just with fewer spreads filled in. Spain is the pilot
 * with every field populated so the layout has something real to
 * land on.
 */
export type RecommendationCategory = "coffee" | "food" | "nature" | "view";

export type Recommendation = {
  /** What's there. Lowercase, sentence fragment. */
  name: string;
  /** Which quadrant of the taste map it lands in. */
  category: RecommendationCategory;
  /** City it belongs to (matches an entry in `cities` when present). */
  city?: string;
};

export type Photo = {
  /** Source URL, served from /public. */
  src: string;
  /** Optional short caption shown under the enlarged frame. */
  caption?: string;
  /** Optional place name (often a city). */
  place?: string;
};

export type CityPin = {
  /** City name (lowercase, matches an entry in `cities`). */
  name: string;
  /** [lon, lat] in degrees, used to position the pin on the
   *  per-country mini-map projection. */
  coords: [number, number];
  /** Optional thumbnail shown on hover/tap of the pin. */
  photo?: string;
  /** One-sentence memory, shown next to the photo. */
  memory?: string;
};

export type DispatchEntry = {
  /** Free-form marker like "day 4" or "morning". */
  day?: string;
  /** City or specific spot. */
  place?: string;
  /** The actual note. Lowercase, conversational. */
  text: string;
};

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
  /** Long-form paragraph for the cover spread. */
  description?: string;
  /** Taste-map recommendations. */
  recommendations?: Recommendation[];
  /** Fallback geographic coordinates [lon, lat] for tiny visits
   *  where the country's TopoJSON silhouette is too small to grab
   *  with a cursor even at the 50m resolution (Seychelles, Maldives,
   *  etc.). When set, the map renders this visit as a small dot
   *  overlay on top of (or instead of) the country polygon — same
   *  hover plate / click-to-modal behaviour. */
  coords?: [number, number];

  /* ---- notebook spreads (all optional) ---- */

  /** Photos for the contact-sheet spread. */
  photos?: Photo[];
  /** City pins for the country-map spread. */
  cityPins?: CityPin[];
  /** Handwritten dispatch entries. */
  dispatch?: DispatchEntry[];
};

const wall = (id: string) => `/images/walls/${id}.webp`;

export const VISITS: Visit[] = [
  {
    iso: "724",
    name: "spain",
    flag: "🇪🇸",
    dates: "september 2023",
    cities: ["barcelona", "girona", "valencia"],
    thumbs: [],
    description:
      "coastal walks along the costa brava, sant pere de rodes monastery at sunset, and slow days in girona's old town.",
    recommendations: [
      { name: "la pubilla, gracia", category: "coffee", city: "barcelona" },
      { name: "calders bookshop, sant antoni", category: "view", city: "barcelona" },
      { name: "sant pere de rodes from el port de la selva", category: "nature", city: "girona" },
      { name: "central del raval at 8am", category: "coffee", city: "barcelona" },
      { name: "bar cañete, dinner late", category: "food", city: "barcelona" },
      { name: "cap de creus before sunrise", category: "nature", city: "girona" },
      { name: "rooftop of la lonja", category: "view", city: "valencia" },
    ],
    photos: [
      { src: wall("wall-1-december25-h"), place: "costa brava", caption: "violet sky, long exposure" },
      { src: wall("wall-1-december25-t"), place: "cap de creus", caption: "wind-shaped pine after sundown" },
      { src: wall("wall-2-january10-s"), place: "girona", caption: "old town at first light" },
      { src: wall("wall-3-july11-ca"), place: "barcelona" },
      { src: wall("wall-4-march11-s"), place: "valencia" },
      { src: wall("wall-4-march11-sp"), place: "el port de la selva", caption: "monastery from below" },
    ],
    cityPins: [
      {
        name: "barcelona",
        coords: [2.17, 41.39],
        photo: wall("wall-3-july11-ca"),
        memory: "late breakfasts in gracia, slow afternoons on the rooftops.",
      },
      {
        name: "girona",
        coords: [2.82, 41.98],
        photo: wall("wall-2-january10-s"),
        memory: "fog hanging over the onyar river, no one out before 9.",
      },
      {
        name: "valencia",
        coords: [-0.38, 39.47],
        photo: wall("wall-4-march11-s"),
        memory: "afternoon light on the silk exchange, paella the colour of clay.",
      },
    ],
    dispatch: [
      {
        day: "day 2",
        place: "barcelona",
        text: "missed the morning train to girona on purpose; ended up at a café where the owner sold us almond tarts wrapped in newspaper.",
      },
      {
        day: "day 4",
        place: "el port de la selva",
        text: "drove the empty road to cap de creus at 5am. salt wind, no other cars. shutter froze once from cold.",
      },
      {
        day: "day 7",
        place: "valencia",
        text: "rooftop of la lonja, last day. the city was beige in every direction and we didn't speak for an hour.",
      },
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
      "atlantic layers off the algarve at first light, tile-clad streets in alfama, and slow evenings on porto's riverfront.",
    recommendations: [
      { name: "adraga beach pre-dawn", category: "nature", city: "sintra" },
      { name: "livraria lello", category: "view", city: "porto" },
      { name: "tram 28 end-to-end", category: "view", city: "lisbon" },
    ],
    photos: [
      { src: wall("wall-2-january10-le"), place: "lisbon" },
      { src: wall("wall-3-february14-p"), place: "porto" },
      { src: wall("wall-4-march11-se"), place: "sintra" },
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
      "misty mornings on skye's quiraing, gallery hopping in london, and edinburgh's old town through low spring fog.",
    recommendations: [
      { name: "quiraing loop", category: "nature", city: "isle of skye" },
      { name: "tate modern, top floor", category: "view", city: "london" },
      { name: "arthur's seat at sunrise", category: "nature", city: "edinburgh" },
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
      "alpine dawns in chamonix, lakeside afternoons in annecy, late-night walks along the seine.",
    recommendations: [
      { name: "aiguille du midi cable car", category: "view", city: "chamonix" },
      { name: "annecy old town canals", category: "nature", city: "annecy" },
      { name: "shakespeare and company at dusk", category: "view", city: "paris" },
    ],
    photos: [{ src: wall("wall-1-july11-la"), place: "pyrenees" }],
  },
  {
    iso: "392",
    name: "japan",
    flag: "🇯🇵",
    dates: "april 2023",
    cities: ["tokyo", "kyoto", "kanazawa"],
    thumbs: [],
    description:
      "cherry blossoms in maruyama park, neon back-alleys of shinjuku, slow tea afternoons in kanazawa.",
    recommendations: [
      { name: "fushimi inari before sunrise", category: "nature", city: "kyoto" },
      { name: "omoide yokocho for ramen", category: "food", city: "tokyo" },
      { name: "kenrokuen garden in early bloom", category: "nature", city: "kanazawa" },
    ],
    photos: [{ src: wall("water-38"), place: "kyoto" }],
  },
  {
    iso: "156",
    name: "china",
    flag: "🇨🇳",
    dates: "may 2017",
    cities: ["beijing", "shanghai", "zhangjiajie"],
    thumbs: [],
    description:
      "sandstone pillars rising out of mist in zhangjiajie, scale of the forbidden city, shanghai skyline at blue hour.",
    recommendations: [
      { name: "tianzi mountain at first light", category: "nature", city: "zhangjiajie" },
      { name: "798 art zone", category: "view", city: "beijing" },
      { name: "the bund from a pudong rooftop", category: "view", city: "shanghai" },
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
      "bali coastline at golden hour, terraced rice fields above ubud, komodo's pink sand beach.",
    recommendations: [
      { name: "tegallalang rice terraces at dawn", category: "nature", city: "bali" },
      { name: "padar island sunrise hike", category: "nature", city: "flores" },
      { name: "tanah lot at low tide", category: "view", city: "bali" },
    ],
    photos: [
      { src: wall("wall-3-february14-i"), place: "bali" },
      { src: wall("sky-2"), place: "lombok" },
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
      "ipanema mornings, colonial streets of paraty, and the granite spires of tijuca in heavy summer light.",
    recommendations: [
      { name: "pedra bonita hike", category: "nature", city: "rio de janeiro" },
      { name: "centro de paraty after the rain", category: "view", city: "paraty" },
      { name: "confeitaria colombo, top floor", category: "coffee", city: "rio de janeiro" },
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
      "granite boulders and shallow turquoise on anse source d'argent, vallée de mai's primeval palms, slow days off-grid.",
    recommendations: [
      { name: "anse source d'argent at low tide", category: "nature", city: "la digue" },
      { name: "vallée de mai morning walk", category: "nature", city: "praslin" },
      { name: "bicycle la digue end to end", category: "nature", city: "la digue" },
    ],
    photos: [
      { src: wall("water-1"), place: "la digue" },
      { src: wall("water-7"), place: "praslin" },
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
      "tea fields in boseong, harbour mornings in busan, hiking the volcanic ridges of jeju.",
    recommendations: [
      { name: "boseong green tea plantation at first light", category: "nature", city: "seoul" },
      { name: "hadong's hwagaecheon at peak bloom", category: "nature", city: "busan" },
      { name: "jeju olle trail #6 from soesokkak", category: "nature", city: "jeju" },
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
      "atacama nights with the milky way overhead, granite towers in torres del paine, fog drifting off valparaíso's hills.",
    recommendations: [
      { name: "valle de la luna at sunset", category: "nature", city: "san pedro de atacama" },
      { name: "el chaltén day hike to laguna capri", category: "nature", city: "puerto natales" },
      { name: "el quitral wine bar, bellavista", category: "food", city: "santiago" },
    ],
  },
];

export const VISIT_BY_ISO = new Map(VISITS.map((v) => [v.iso, v]));
