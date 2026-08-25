/** Project facts for the public site — one editable place.
 *
 * Everything a non-developer is likely to want to change (location wording,
 * distances, contact details, photo paths) lives here rather than being buried
 * in JSX across several sections.
 *
 * IMPORTANT — the fields marked CONFIRM below are placeholders. They are
 * written vaguely on purpose: I do not know the exact plot-to-temple distance,
 * the registered address, or the phone number, and a real-estate page that
 * states a distance it cannot support is a liability, not a detail. Replace
 * them with surveyed/verified values before the site is promoted. */

export const PROJECT = {
  name: "Shyam Vatika",
  /** Township/locality line used under the hero and in the location section. */
  locality: "खाटू श्याम जी",
  district: "सीकर, राजस्थान",
  localityEn: "Khatu Shyam Ji",
  districtEn: "Sikar, Rajasthan",

  /** Still non-numeric, and deliberately so.
   *
   * The site coordinates below are exact, but the temple's own published
   * coordinates disagree between sources by roughly nine kilometres of
   * longitude, so any "X km from the temple" line on this page would be a
   * number we cannot stand behind. A buyer who drives out and finds it wrong
   * does not forgive it. Until someone measures the road distance, the page
   * says "near" in words and hands over a Get directions button instead —
   * which tells each visitor the real distance from wherever they actually
   * are, and is more useful than our average anyway.
   *
   * CONFIRM: replace with a surveyed road distance and drive time. */
  templeProximity: "खाटू श्याम धाम के निकट",
  templeProximityEn: "Close to Khatu Shyam Dham",

  /** CONFIRM: office address, phone and WhatsApp before launch. */
  phone: "",
  whatsapp: "",
  officeAddress: "",
} as const;

/** The site itself, as supplied by the owner from Google Maps.
 *
 * `mapsUrl` and `directionsUrl` are built from the coordinates using Google's
 * documented Maps URL parameters rather than pasted from the browser address
 * bar. A pasted URL carries a viewport, a zoom level and a session tracking
 * token (`g_ep=…`) that goes stale; these two forms are stable and will keep
 * resolving to this exact point years from now. */
export const SITE = {
  lat: 27.448296,
  lng: 75.498354,
  /** What Google shows for the pin — useful for anyone comparing by eye. */
  dms: `27°26'53.9"N 75°29'54.1"E`,
  /** Plus Code. Works in Google Maps search on its own, and is short enough
   * to read out over a phone call, which the decimal pair is not. */
  plusCode: "CFXX+889 Malikpur, Rajasthan",
  village: "Malikpur",
  villageHi: "मालिकपुर",
} as const;

export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${SITE.lat},${SITE.lng}`;
export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${SITE.lat},${SITE.lng}`;

/** Plot economics. These mirror the seeded business rules and the Channel
 * Partner deck exactly — see docs/07-product-alignment-audit.md §A15. Changing
 * a number here without changing the rule in apps/api/prisma/seed.ts would put
 * the website and the engine out of sync, so don't. */
export const PLOT = {
  sizeLabel: "15 × 30",
  gaj: 50,
  ratePerGaj: 7_000,
  plotAmount: 3_50_000,
  registration: 1_000,
  total: 3_51_000,
} as const;

/** The 90-day plan, 30 / 30 / 40. */
export const PAYMENT_PLAN = [
  { month: "महीना 1", monthEn: "Month 1", percent: "30%", amount: 1_05_000 },
  { month: "महीना 2", monthEn: "Month 2", percent: "30%", amount: 1_05_000 },
  { month: "महीना 3", monthEn: "Month 3", percent: "40%", amount: 1_40_000 },
] as const;

export const AMENITIES = [
  { hi: "सड़क", en: "Roads", note: "Internal concrete roads throughout the society." },
  { hi: "बिजली", en: "Electricity", note: "Electrified layout with street lighting." },
  { hi: "पानी", en: "Water", note: "Water supply provision across sectors." },
  { hi: "पार्क", en: "Park", note: "Landscaped open green space." },
  { hi: "मार्केट", en: "Market", note: "Dedicated market area within the society." },
  { hi: "गेस्ट हाउस", en: "Guest House", note: "Guest house for visiting families." },
] as const;

/** Photo slots. Drop files into apps/web/public/photos/ and set `src` here —
 * every position already renders a designed panel when src is empty, so the
 * page never shows a broken image while you are still sourcing shots.
 * See apps/web/public/photos/README.md for the shot list and aspect ratios. */
export const PHOTOS = {
  hero: "", // 21:9 — aerial or approach road to the township
  temple: "", // 4:3 — Khatu Shyam Ji temple exterior
  siteEntry: "", // 3:2 — society gate / entrance arch
  roads: "", // 4:3 — internal developed road
  park: "", // 4:3 — landscaped park
  plotLayout: "", // 16:9 — layout plan / demarcated plots
} as const;

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
