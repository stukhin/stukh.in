/**
 * Visited countries — the data driving /blog. Each entry is keyed by
 * its ISO 3166-1 numeric code (matching the `id` field in
 * world-atlas/countries-50m.json) so the map's path renderer can
 * look the visit up directly off the geometry it just drew.
 *
 * Country panel = the "field notebook" (BlogCountryModal), three
 * horizontally-paged spreads instead of a vertical dossier:
 *   1. cover   — hero photo, name, fact row, jump links
 *   2. taste   — `recommendations` on a 4-quadrant flavour grid
 *                by `category`; click a chip to lock it centred
 *   3. gallery — contact prints from `photos`
 *
 * Optional fields degrade gracefully — countries with only the
 * legacy shape (description + cities + plain string recs) still
 * render, just with fewer spreads. Spain is the pilot with every
 * field populated so the layout has something real to land on.
 */
export type RecommendationCategory = "coffee" | "food" | "nature" | "view";

export type Recommendation = {
  /** What's there. Lowercase, sentence fragment. */
  name: string;
  /** Which quadrant of the taste map it lands in. */
  category: RecommendationCategory;
  /** City it belongs to (matches an entry in `cities` when present). */
  city?: string;
  /** Extra context shown when the chip is hovered/locked open. */
  note?: string;
  /** Optional photo URL shown in the locked card. */
  photo?: string;
};

export type Photo = {
  /** Source URL, served from /public. */
  src: string;
  /** Optional short caption shown under the enlarged frame. */
  caption?: string;
  /** Optional place name (often a city). */
  place?: string;
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

  /** Photos for the gallery spread (first one is the cover hero). */
  photos?: Photo[];
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
      {
        name: "la pubilla",
        category: "coffee",
        city: "barcelona",
        note: "opens at 8am sharp. ask for the pa amb tomàquet — it's the kind that makes you skip lunch.",
      },
      {
        name: "calders bookshop",
        category: "view",
        city: "barcelona",
        note: "tiny indie in sant antoni. the staircase to the back room is where the light always wins.",
      },
      {
        name: "sant pere de rodes",
        category: "nature",
        city: "girona",
        note: "two-hour climb out of el port de la selva to a 10th-century monastery. sunset light hits the stone at 19:00 in september.",
        photo: wall("wall-4-march11-sp"),
      },
      {
        name: "central del raval",
        category: "coffee",
        city: "barcelona",
        note: "outdoor tables next to macba. coffee is fine; the people-watching is the point.",
      },
      {
        name: "bar cañete",
        category: "food",
        city: "barcelona",
        note: "no menu. order the carrillada and whatever the bartender suggests after.",
      },
      {
        name: "cap de creus",
        category: "nature",
        city: "girona",
        note: "easternmost point of mainland spain. wind, lighthouse, salt. go before sunrise — there's no one and the road is yours.",
        photo: wall("wall-1-december25-t"),
      },
      {
        name: "la lonja rooftop",
        category: "view",
        city: "valencia",
        note: "5€ entry, never a queue. the silk exchange ceiling pattern is wilder than anything below it.",
      },
    ],
    photos: [
      { src: wall("wall-1-december25-h"), place: "costa brava", caption: "violet sky, long exposure" },
      { src: wall("wall-1-december25-t"), place: "cap de creus", caption: "wind-shaped pine after sundown" },
      { src: wall("wall-2-january10-s"), place: "girona", caption: "old town at first light" },
      { src: wall("wall-3-july11-ca"), place: "barcelona" },
      { src: wall("wall-4-march11-s"), place: "valencia" },
      { src: wall("wall-4-march11-sp"), place: "el port de la selva", caption: "monastery from below" },
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
