/**
 * Seed script for the "Silvertown Demo" project.
 *
 * Builds a complete, realistic fictional consultation for a client demo:
 *   - one project with three development plots
 *   - the plots as GeoLayer boundaries (admin map) AND clickable polygon pins
 *     (public embed — the embed only renders pins + overlays, not GeoLayers)
 *   - ~45 map-feedback pins spread across the three plots
 *   - a consultation survey (with audience + plot-of-interest questions)
 *   - a "Register for updates" form with signups
 *   - public enquiries
 *   - a stakeholder register with an engagement log
 *   - a pre-computed AI analysis, built with the product's own cross-reference
 *     maths, so the insight dashboard is populated instantly with no paid run
 *
 * Idempotent: uses a fixed project id, clears its children, then rebuilds.
 * Run with:  npx tsx prisma/seed-silvertown.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as turf from '@turf/turf'
import {
  crossReference,
  CrossRefItem,
  CrossRefAssignment,
} from '../src/lib/cross-reference'

const prisma = new PrismaClient()

const PROJECT_ID = 'silvertown-demo'
const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(NOW - days * DAY)

// ---------------------------------------------------------------------------
// Theme taxonomy — the stable list every response is classified against.
// ---------------------------------------------------------------------------
const TAXONOMY = [
  { name: 'Housing & affordability', description: 'Amount, mix, tenure and affordability of new homes.', keywords: ['affordable', 'homes', 'tenure', 'social rent', 'family'] },
  { name: 'Traffic, parking & transport', description: 'Road congestion, parking provision, buses, DLR and active travel.', keywords: ['traffic', 'parking', 'DLR', 'buses', 'congestion'] },
  { name: 'Height, density & design', description: 'Building heights, massing, density and architectural quality.', keywords: ['height', 'tall', 'density', 'design', 'massing'] },
  { name: 'Green space & public realm', description: 'Parks, squares, play space and quality of the public realm.', keywords: ['green', 'park', 'public realm', 'play', 'square'] },
  { name: 'Jobs, workspace & local economy', description: 'Employment, affordable workspace and support for local business.', keywords: ['jobs', 'workspace', 'business', 'economy', 'employment'] },
  { name: 'Heritage & waterfront character', description: 'The listed mills, dock heritage and waterfront character.', keywords: ['heritage', 'mills', 'dock', 'waterfront', 'listed'] },
  { name: 'Community facilities & services', description: 'Schools, GP surgeries, healthcare and community space capacity.', keywords: ['school', 'GP', 'healthcare', 'community', 'services'] },
  { name: 'Construction impact & phasing', description: 'Noise, dust, HGV movements, hours and the phasing of works.', keywords: ['construction', 'noise', 'dust', 'phasing', 'HGV'] },
  { name: 'Environment & sustainability', description: 'Flooding, biodiversity, energy, air quality and net zero.', keywords: ['flood', 'biodiversity', 'sustainability', 'air quality', 'net zero'] },
]

// ---------------------------------------------------------------------------
// The three plots. Rectangles roughly 120m × 150m along the Silvertown dockside.
// Polygon rings are [lng, lat], closed.
// ---------------------------------------------------------------------------
type Plot = {
  key: '1' | '1JC' | 'D'
  name: string
  blurb: string
  status: string
  color: string
  centroid: [number, number] // [lat, lng]
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }
}

const PLOTS: Plot[] = [
  {
    key: '1',
    name: 'Plot 1',
    blurb: 'The gateway plot on the north-west corner, fronting Royal Victoria Dock at the new dock bridge landing and next to the Grade II listed Millennium Mills. A residential-led, mixed-use building of around 265–304 homes (1–2 bed) with ground-floor retail and a dockside restaurant, at the northern end of Spillers Street.',
    status: 'Outline (HPA 22/02855/OUT) — awaiting consent; RMA to follow',
    color: '#0E7C86',
    centroid: [51.5031, 0.0250],
    bounds: { latMin: 51.5026, latMax: 51.5036, lngMin: 0.0238, lngMax: 0.0262 },
  },
  {
    key: '1JC',
    name: 'Plot 1J&C',
    blurb: 'The central plot on Spillers Street — south of Millennium Mills, west of Silo D, north of the Finger Dock. Around 676 homes (studios to 3-bed) with ground-floor commercial on Mills Street and Spillers Street, and an active, F&B-lined dock edge onto Silo D Park.',
    status: 'Outline consented Dec 2025 — RMA due by March 2027',
    color: '#2563EB',
    centroid: [51.5023, 0.0275],
    bounds: { latMin: 51.5017, latMax: 51.5029, lngMin: 0.0262, lngMax: 0.0290 },
  },
  {
    key: 'D',
    name: 'Silo D',
    blurb: 'The historically listed Silo D building and Silo D Park by the Finger Dock — an active ground floor for events and community use, with the residential Silo D Quarter above. Planning strategy still to be confirmed.',
    status: 'Early stage — planning strategy to be confirmed',
    color: '#16A34A',
    centroid: [51.5024, 0.0308],
    bounds: { latMin: 51.5018, latMax: 51.5030, lngMin: 0.0296, lngMax: 0.0322 },
  },
]

const plotRing = (p: Plot): number[][] => {
  const { latMin, latMax, lngMin, lngMax } = p.bounds
  return [
    [lngMin, latMin],
    [lngMax, latMin],
    [lngMax, latMax],
    [lngMin, latMax],
    [lngMin, latMin],
  ]
}

// Seeded PRNG so pin scatter is reproducible across reseeds (no teleporting).
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A random point strictly inside a polygon (rejection-sampled within its bbox).
// Works for any shape, so pins follow admin-edited zone outlines.
function scatterInPolygon(geometry: any, rng: () => number): [number, number] {
  const poly = turf.polygon(geometry.coordinates)
  const [minX, minY, maxX, maxY] = turf.bbox(poly)
  for (let k = 0; k < 400; k++) {
    const lng = minX + rng() * (maxX - minX)
    const lat = minY + rng() * (maxY - minY)
    if (turf.booleanPointInPolygon(turf.point([lng, lat]), poly)) return [lat, lng]
  }
  const c = turf.centroid(poly).geometry.coordinates as number[]
  return [c[1], c[0]]
}

// ---------------------------------------------------------------------------
// Map-feedback pins. category drives the map icon; sentiment/themes drive the
// analysis. daysAgo backdates so the participation timeline has a shape.
// ---------------------------------------------------------------------------
type Sent = 'positive' | 'negative' | 'neutral'
type PinSeed = {
  plot: Plot['key']
  category: 'positive' | 'negative' | 'question' | 'comment'
  comment: string
  sentiment: Sent
  themes: number[]
  votes: number
  daysAgo: number
}

const PINS: PinSeed[] = [
  // --- Plot 1 (gateway, Millennium Mills, dock frontage, retail — broadly positive) ---
  { plot: '1', category: 'positive', comment: 'Brilliant that Plot 1 sits right next to Millennium Mills — the gateway building must respect that heritage.', sentiment: 'positive', themes: [5, 2], votes: 24, daysAgo: 52 },
  { plot: '1', category: 'positive', comment: 'Love that the dock edge will have cafes and a restaurant. Somewhere to sit by Royal Victoria Dock at last.', sentiment: 'positive', themes: [3, 4], votes: 19, daysAgo: 48 },
  { plot: '1', category: 'negative', comment: 'A tall "gateway" tower here will block views across the dock. Keep the height sensible next to the Mills.', sentiment: 'negative', themes: [2], votes: 31, daysAgo: 44 },
  { plot: '1', category: 'question', comment: 'Will the new Royal Victoria Dock Bridge be step-free and open at all hours?', sentiment: 'neutral', themes: [1], votes: 6, daysAgo: 40 },
  { plot: '1', category: 'positive', comment: 'Retail on Spillers Street with florists and small shops sounds lovely — please keep it independent.', sentiment: 'positive', themes: [4], votes: 15, daysAgo: 34 },
  { plot: '1', category: 'comment', comment: 'Please make sure the ground-floor retail is genuinely affordable for local traders, not just chains.', sentiment: 'neutral', themes: [4], votes: 9, daysAgo: 30 },
  { plot: '1', category: 'negative', comment: '300 private flats and no affordable homes on Plot 1? That is disappointing for a gateway plot.', sentiment: 'negative', themes: [0], votes: 27, daysAgo: 26 },
  { plot: '1', category: 'positive', comment: 'Great connectivity — Elizabeth line at Custom House and DLR at Pontoon Dock. Right place for homes.', sentiment: 'positive', themes: [1, 0], votes: 12, daysAgo: 22 },
  { plot: '1', category: 'question', comment: 'How tall is the proposed Plot 1 building compared to Millennium Mills?', sentiment: 'neutral', themes: [2, 5], votes: 5, daysAgo: 18 },
  { plot: '1', category: 'comment', comment: 'A restaurant on the dock would be a real destination — just get the servicing and deliveries right.', sentiment: 'neutral', themes: [4, 1], votes: 8, daysAgo: 14 },
  { plot: '1', category: 'positive', comment: 'The brick-and-steel palette responding to the industrial character is well judged.', sentiment: 'positive', themes: [2, 5], votes: 10, daysAgo: 9 },
  { plot: '1', category: 'negative', comment: 'Construction traffic on North Woolwich Road is already awful — building Plot 1 first will make it worse.', sentiment: 'negative', themes: [7, 1], votes: 17, daysAgo: 6 },
  { plot: '1', category: 'positive', comment: 'Opening the dock edge to the public at the bridge landing is the best thing in these plans.', sentiment: 'positive', themes: [3], votes: 21, daysAgo: 4 },
  { plot: '1', category: 'comment', comment: 'Please include some family-sized homes, not only 1 and 2-beds.', sentiment: 'neutral', themes: [0], votes: 11, daysAgo: 2 },

  // --- Plot 1J&C (676 homes, density/height, Spillers St, dock edge — more mixed/negative) ---
  { plot: '1JC', category: 'negative', comment: '676 homes on Plot 1J&C is far too dense. This stretch of Spillers Street will feel like a canyon.', sentiment: 'negative', themes: [2], votes: 38, daysAgo: 50 },
  { plot: '1JC', category: 'negative', comment: 'Where will everyone park? The DLR is already rammed at rush hour and there is barely any parking.', sentiment: 'negative', themes: [1], votes: 42, daysAgo: 49 },
  { plot: '1JC', category: 'positive', comment: 'The active dock edge with F&B onto Silo D Park could be wonderful — a proper waterside destination.', sentiment: 'positive', themes: [3, 4], votes: 18, daysAgo: 46 },
  { plot: '1JC', category: 'negative', comment: 'The tallest blocks on Plot 1J&C will overshadow Silo D Park all afternoon. Has a daylight study been done?', sentiment: 'negative', themes: [2, 3], votes: 20, daysAgo: 43 },
  { plot: '1JC', category: 'positive', comment: 'We badly need homes and this is right by the transport. Build them — but get the mix right.', sentiment: 'positive', themes: [0], votes: 23, daysAgo: 40 },
  { plot: '1JC', category: 'negative', comment: 'Only a fraction affordable on 676 homes? For consented dock land that is not good enough.', sentiment: 'negative', themes: [0], votes: 34, daysAgo: 36 },
  { plot: '1JC', category: 'question', comment: 'What is the affordable tenure split — social rent vs shared ownership — on Plot 1J&C?', sentiment: 'neutral', themes: [0], votes: 7, daysAgo: 31 },
  { plot: '1JC', category: 'comment', comment: 'Step the heights down towards the existing Britannia Village homes and it would be far more acceptable.', sentiment: 'neutral', themes: [2], votes: 16, daysAgo: 26 },
  { plot: '1JC', category: 'positive', comment: 'Studios to 3-beds is a good mix. Please make the 3-beds genuinely family-friendly.', sentiment: 'positive', themes: [0], votes: 10, daysAgo: 22 },
  { plot: '1JC', category: 'negative', comment: 'Commercial units along Mills Street are welcome, but blank servicing yards would kill the street.', sentiment: 'negative', themes: [4, 2], votes: 12, daysAgo: 17 },
  { plot: '1JC', category: 'question', comment: 'Will the dock-edge public realm be open to everyone, or gated for residents?', sentiment: 'neutral', themes: [3], votes: 8, daysAgo: 12 },
  { plot: '1JC', category: 'positive', comment: 'Ground-floor commercial on Spillers Street will bring the high street to life.', sentiment: 'positive', themes: [4], votes: 11, daysAgo: 8 },
  { plot: '1JC', category: 'negative', comment: 'Cumulative construction across Plot 1J&C and the rest of Phase 1 needs a proper logistics plan.', sentiment: 'negative', themes: [7], votes: 13, daysAgo: 5 },
  { plot: '1JC', category: 'comment', comment: 'Please provide generous secure cycle parking for 676 homes, not a token rack.', sentiment: 'neutral', themes: [1, 8], votes: 9, daysAgo: 2 },

  // --- Silo D (listed Silo D, Silo D Park, community, heritage — mostly positive) ---
  { plot: 'D', category: 'positive', comment: 'Restoring the historic Silo D instead of demolishing it is exactly right. Do not lose the industrial heritage.', sentiment: 'positive', themes: [5], votes: 33, daysAgo: 47 },
  { plot: 'D', category: 'positive', comment: 'Silo D Park by the Finger Dock could be a fantastic community space — please make it genuinely public.', sentiment: 'positive', themes: [3, 6], votes: 28, daysAgo: 43 },
  { plot: 'D', category: 'question', comment: 'When will Silo D’s planning strategy be confirmed? It feels the least developed of the three plots.', sentiment: 'neutral', themes: [6], votes: 12, daysAgo: 37 },
  { plot: 'D', category: 'positive', comment: 'An active ground floor for events in Silo D would give the community a real home.', sentiment: 'positive', themes: [6], votes: 17, daysAgo: 33 },
  { plot: 'D', category: 'comment', comment: 'Native planting and a wetland edge in Silo D Park would be great for biodiversity.', sentiment: 'neutral', themes: [8, 3], votes: 11, daysAgo: 29 },
  { plot: 'D', category: 'positive', comment: 'Keep Silo D’s raw industrial character — do not over-polish the restoration.', sentiment: 'positive', themes: [5, 2], votes: 14, daysAgo: 25 },
  { plot: 'D', category: 'negative', comment: 'Worried Silo D Park will be delivered last, years after the flats, like every other scheme here.', sentiment: 'negative', themes: [7, 3], votes: 24, daysAgo: 20 },
  { plot: 'D', category: 'positive', comment: 'A café and space for markets or events on Silo D Park would bring people together.', sentiment: 'positive', themes: [6, 4], votes: 16, daysAgo: 16 },
  { plot: 'D', category: 'question', comment: 'Will homes above Silo D overlook the park, and will the park stay open in the evenings?', sentiment: 'neutral', themes: [3, 2], votes: 6, daysAgo: 13 },
  { plot: 'D', category: 'positive', comment: 'Great to be engaged this early on Silo D — keep listening as the plans develop.', sentiment: 'positive', themes: [6], votes: 10, daysAgo: 8 },
  { plot: 'D', category: 'comment', comment: 'Please include a proper playground and space for teenagers in Silo D Park, not just lawns.', sentiment: 'neutral', themes: [3, 6], votes: 8, daysAgo: 5 },
  { plot: 'D', category: 'negative', comment: 'Events on Silo D Park must not mean noise late into the night for nearby homes.', sentiment: 'negative', themes: [6], votes: 9, daysAgo: 3 },
  { plot: 'D', category: 'positive', comment: 'The listed Silo D as a landmark at the Finger Dock is a real asset — celebrate it.', sentiment: 'positive', themes: [5], votes: 13, daysAgo: 1 },
]

// ---------------------------------------------------------------------------
// An organised campaign: a shared template objection to Plot 1J&C with one
// personal line each. Drives the campaign / duplicate detection panel.
// ---------------------------------------------------------------------------
const CAMPAIGN_TEMPLATE =
  'I strongly object to the proposals for Plot 1J&C. 676 homes at this density, with far too little parking and a DLR that is already at capacity at peak times, will overwhelm Silvertown. The scheme must not go ahead without a binding transport and parking plan.'
const CAMPAIGN_PERSONAL = [
  'I have lived in Britannia Village for twelve years and already cannot park near my own home.',
  'As a parent doing the school run, the extra rat-running traffic frightens me.',
  'I depend on the DLR every day and it is already unbearable at rush hour.',
  'My elderly mother needs a Blue Badge space and there are none to be found now.',
  'We were promised no more overdevelopment after the last scheme went up.',
  'I run a small business nearby and my customers already have nowhere to park.',
]

// ---------------------------------------------------------------------------
// Consultation survey responses. Fields chosen so the audience + plot cuts work.
// ---------------------------------------------------------------------------
const AUDIENCE_OPTIONS = ['Local resident', 'Business / worker', 'Community group', 'Landowner / developer', 'Visitor', 'Other']
const PLOT_OPTIONS = ['Plot 1', 'Plot 1J&C', 'Silo D', 'The whole programme']
const SUPPORT_OPTIONS = ['Strongly support', 'Support', 'Neutral', 'Oppose', 'Strongly oppose']

type SurveySeed = {
  audience: string
  plot: string
  support: string
  likes: string
  concerns: string
  suggestions: string
  sentiment: Sent
  themes: number[]
  daysAgo: number
}

const SURVEY: SurveySeed[] = [
  { audience: 'Local resident', plot: PLOT_OPTIONS[0], support: 'Strongly support', likes: 'A gateway building next to Millennium Mills, opening the dock edge to the public at the new bridge landing.', concerns: 'That there are no affordable homes at all in Plot 1.', suggestions: 'Add some affordable homes, and a heritage trail along the dock.', sentiment: 'positive', themes: [5, 0], daysAgo: 51 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'The active dock edge idea is nice.', concerns: '676 homes is far too dense and there is nowhere near enough parking.', suggestions: 'Reduce the density and provide proper parking and a transport plan.', sentiment: 'negative', themes: [2, 1], daysAgo: 50 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'Ground-floor retail and a dockside restaurant on Plot 1 would be transformational for footfall.', concerns: 'Construction disruption to existing businesses on North Woolwich Road.', suggestions: 'Phase the works so the road isn’t closed for years.', sentiment: 'positive', themes: [4, 7], daysAgo: 46 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'Restoring the historic Silo D and creating Silo D Park. Both are desperately needed at this end.', concerns: 'That Silo D Park arrives years after the flats.', suggestions: 'Commit to delivering Silo D Park early, in writing.', sentiment: 'positive', themes: [5, 3, 7], daysAgo: 45 },
  { audience: 'Community group', plot: PLOT_OPTIONS[3], support: 'Neutral', likes: 'Ambition is good and the heritage approach around Millennium Mills and Silo D is sensitive.', concerns: 'Cumulative traffic and healthcare capacity across all three plots have not been addressed together.', suggestions: 'Publish a programme-wide transport and healthcare capacity plan, not three separate ones.', sentiment: 'neutral', themes: [1, 6], daysAgo: 42 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Strongly oppose', likes: 'Honestly very little.', concerns: 'Overdevelopment, loss of light to existing homes and to Silo D Park, and pressure on GP surgeries that are already full.', suggestions: 'Go back and design something at a human scale.', sentiment: 'negative', themes: [2, 6], daysAgo: 41 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Support', likes: 'We need the homes and it’s right by the DLR and Spillers Street high street.', concerns: 'The affordable housing share should be higher.', suggestions: 'Push the affordable share up, with a proper social rent element.', sentiment: 'positive', themes: [0], daysAgo: 38 },
  { audience: 'Visitor', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'I’d come to Silvertown for a restored dockside with cafes next to Millennium Mills. Great destination potential.', concerns: 'Keep some of the raw industrial character, don’t over-polish it.', suggestions: 'Retain and celebrate the Mills and Silo D as landmarks.', sentiment: 'positive', themes: [5, 4], daysAgo: 35 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Support', likes: 'The active ground floor of Silo D and Silo D Park for community use.', concerns: 'Will Silo D be genuinely affordable for local groups to book?', suggestions: 'Ring-fence subsidised community hours in Silo D.', sentiment: 'positive', themes: [6, 3], daysAgo: 33 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[1], support: 'Neutral', likes: 'Ground-floor commercial on Spillers Street could bring footfall.', concerns: 'Construction access and loss of parking for customers during the build.', suggestions: 'A construction logistics plan agreed with local traders.', sentiment: 'neutral', themes: [7, 1], daysAgo: 30 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'Nothing about the height.', concerns: 'The tallest blocks will overshadow Silo D Park every afternoon.', suggestions: 'Commission and publish a daylight and sunlight study.', sentiment: 'negative', themes: [2, 3], daysAgo: 27 },
  { audience: 'Community group', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'Early engagement on Silo D is welcome and keeping the listed building is vital.', concerns: 'Noise from events on Silo D Park late at night.', suggestions: 'An events management plan agreed with residents.', sentiment: 'positive', themes: [5, 6], daysAgo: 24 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'Sympathetic gateway design next to the Mills, and new dockside life.', concerns: 'Building height right next to the listed Millennium Mills.', suggestions: 'Keep the new block below the Mills roofline.', sentiment: 'positive', themes: [5, 2], daysAgo: 21 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[3], support: 'Neutral', likes: 'Some good ideas across the plots.', concerns: 'Flood risk and drainage on reclaimed dock land over the long term.', suggestions: 'Independent flood modelling published for consultation.', sentiment: 'neutral', themes: [8], daysAgo: 18 },
  { audience: 'Landowner / developer', plot: PLOT_OPTIONS[3], support: 'Support', likes: 'A coordinated Phase 1 masterplan across Plot 1, Plot 1J&C and Silo D is the right approach.', concerns: 'Certainty on infrastructure timing to support delivery.', suggestions: 'A clear phasing and infrastructure trigger schedule.', sentiment: 'positive', themes: [7, 1], daysAgo: 16 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'The homes are needed in principle.', concerns: 'But not at this density with no transport upgrade. The DLR cannot cope.', suggestions: 'Fund a DLR frequency increase as part of the scheme.', sentiment: 'negative', themes: [1, 2], daysAgo: 13 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'The restored Silo D, the park and the lower-rise homes around it. All good.', concerns: 'Just deliver Silo D Park early.', suggestions: 'Park first, please.', sentiment: 'positive', themes: [3, 5], daysAgo: 10 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[0], support: 'Strongly support', likes: 'Independent retail on Spillers Street would keep small firms in the area.', concerns: 'Rent levels once the units open.', suggestions: 'Reserve some units for local independents at affordable rents.', sentiment: 'positive', themes: [4], daysAgo: 7 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Neutral', likes: 'Dock edge and shops.', concerns: 'Overlooking and privacy for existing Britannia Village residents.', suggestions: 'Greater set-backs from existing homes.', sentiment: 'neutral', themes: [2], daysAgo: 4 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[3], support: 'Support', likes: 'Overall the Phase 1 programme could be great for Silvertown if it’s done properly.', concerns: 'Keeping the community informed as it moves through each phase.', suggestions: 'Regular updates and keep this map open throughout.', sentiment: 'positive', themes: [6], daysAgo: 2 },
]

// ---------------------------------------------------------------------------
// "Register for updates" signups. No free-text, so these never enter the AI
// corpus — they are participation data (registrations), not feedback.
// ---------------------------------------------------------------------------
const REGISTER_INTERESTS = ['Public events & drop-ins', 'Planning milestones', 'Construction updates', 'Jobs & workspace', 'Community facilities']
const REGISTRATIONS = Array.from({ length: 34 }).map((_, i) => {
  const first = ['Amara', 'Ben', 'Chloe', 'Daniel', 'Ewa', 'Femi', 'Grace', 'Hassan', 'Isla', 'Jacob', 'Kiran', 'Lena', 'Marcus', 'Nadia', 'Omar', 'Priya', 'Rosa', 'Sam', 'Tomas', 'Uma', 'Vikram', 'Wendy', 'Xin', 'Yusuf', 'Zara', 'Adaeze', 'Beatriz', 'Callum', 'Dinah', 'Eddie', 'Farah', 'Gary', 'Hana', 'Ivo'][i % 34]
  const last = ['Adeyemi', 'Brooks', 'Chen', 'Doyle', 'Evans', 'Ferreira', 'Gill', 'Hughes', 'Ibrahim', 'Jones', 'Khan', 'Lewis', 'Mensah', 'Novak', 'Osei', 'Patel', 'Quinn', 'Reed', 'Silva', 'Turner'][i % 20]
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
    postcode: ['E16 2AA', 'E16 1AB', 'E16 2QU', 'E16 1FA', 'E16 2PB'][i % 5],
    interest: REGISTER_INTERESTS[i % REGISTER_INTERESTS.length],
    plot: PLOT_OPTIONS[i % PLOT_OPTIONS.length],
    daysAgo: Math.max(1, 56 - i * 1.6) | 0,
  }
})

// ---------------------------------------------------------------------------
// Public enquiries — subject + message join the AI corpus.
// ---------------------------------------------------------------------------
type EnquirySeed = {
  name: string
  email: string
  org?: string
  phone?: string
  subject: string
  message: string
  category: string
  sentiment: Sent
  themes: number[]
  daysAgo: number
}

const ENQUIRIES: EnquirySeed[] = [
  { name: 'Sandra Okoro', email: 'sandra.okoro@email.com', subject: 'Parking permits for existing residents', org: undefined, phone: '07700 900123', message: 'I have lived in Britannia Village for 20 years. With 676 new homes on Plot 1J&C and almost no parking, where will the new residents park? On our streets. What protection is there for existing residents — will there be a controlled parking zone?', category: 'objection', sentiment: 'negative', themes: [1], daysAgo: 48 },
  { name: 'Royal Docks Traders Forum', email: 'info@rdtraders.org', org: 'Royal Docks Traders Forum', subject: 'Retail units and construction logistics for local businesses', message: 'On behalf of local traders we welcome the ground-floor retail on Plot 1 and Spillers Street. However we need a construction logistics plan that keeps North Woolwich Road open and protects footfall during the build. Can we meet to discuss a traders’ liaison group?', category: 'general', sentiment: 'positive', themes: [4, 7], daysAgo: 44 },
  { name: 'Dr Helen Marsh', email: 'h.marsh@nhs.net', org: 'Pontoon Dock Surgery', subject: 'Healthcare capacity across Phase 1', message: 'As a local GP I am concerned that the cumulative impact of Plot 1, Plot 1J&C and Silo D on primary care has not been assessed. Our list is already at capacity. Has a health impact assessment been done for the whole of Phase 1, and is space allocated for a branch surgery?', category: 'planning', sentiment: 'negative', themes: [6], daysAgo: 41 },
  { name: 'Silvertown Heritage Society', email: 'contact@silvertownheritage.org', org: 'Silvertown Heritage Society', subject: 'Protection of Millennium Mills and Silo D', message: 'We strongly support restoration but need clarity on exactly which structures are retained. The Grade II listed Millennium Mills and the historic Silo D must be protected in full. We request a meeting and sight of the heritage statement.', category: 'planning', sentiment: 'neutral', themes: [5], daysAgo: 37 },
  { name: 'James Whitfield', email: 'j.whitfield@outlook.com', subject: 'Building heights on Plot 1J&C', message: 'The tallest blocks on Plot 1J&C look completely out of scale next to Silo D Park. Has a daylight and sunlight assessment been carried out for neighbouring homes and the park? I would like to see it before the RMA is submitted.', category: 'objection', sentiment: 'negative', themes: [2, 3], daysAgo: 32 },
  { name: 'Grace Adeyemi', email: 'grace.a@gmail.com', subject: 'Silo D Park and community use', message: 'We are delighted about Silo D Park and the active ground floor of Silo D. Can you confirm how much of Silo D will be for community use, whether local groups can book it, and when the park would open relative to the homes being occupied?', category: 'support', sentiment: 'positive', themes: [6, 3], daysAgo: 28 },
  { name: 'Newham Cyclists', email: 'hello@newhamcyclists.org', org: 'Newham Cyclists', subject: 'Active travel and cycle parking', message: 'Please ensure secure, generous cycle parking across all three plots and a continuous cycle route along the dockside and Spillers Street. Token provision for 676 homes will not do. We would welcome involvement in the transport design.', category: 'general', sentiment: 'neutral', themes: [1, 8], daysAgo: 24 },
  { name: 'Michael Brennan', email: 'm.brennan@email.com', subject: 'Construction hours and night shifts', message: 'I work nights at the hospital. The proposed 7am start for construction will make it impossible to sleep. Please confirm the working hours, weekend policy and how noise will be controlled across the Phase 1 plots.', category: 'complaint', sentiment: 'negative', themes: [7], daysAgo: 19 },
  { name: 'Priya Nair', email: 'priya.nair@email.com', subject: 'Affordable housing tenure on Plot 1J&C', message: 'Can you set out the affordable housing tenure split for Plot 1J&C? How much is social rent versus shared ownership, and how were the income thresholds set? The affordable share feels low for consented dock land.', category: 'planning', sentiment: 'negative', themes: [0], daysAgo: 15 },
  { name: 'Thames Estuary Partnership', email: 'info@thamesestuary.org', org: 'Thames Estuary Partnership', subject: 'Flood resilience and biodiversity', message: 'We would like to understand the flood resilience strategy for the dock edge and how biodiversity net gain will be delivered, particularly the planting and wetland edge suggested for Silo D Park. Please share the environmental documents.', category: 'general', sentiment: 'neutral', themes: [8, 3], daysAgo: 11 },
  { name: 'Anthony Cole', email: 'a.cole@email.com', subject: 'Overlooking and privacy', message: 'My flat directly faces the tallest proposed block on Plot 1J&C. I am very concerned about overlooking and loss of privacy. What set-back distances are proposed and will there be screening?', category: 'objection', sentiment: 'negative', themes: [2], daysAgo: 8 },
  { name: 'Ruth Bello', email: 'ruth.bello@email.com', org: 'Silvertown Community Network', subject: 'Booking space in Silo D', message: 'The active ground floor of Silo D is a great idea. Will local groups be able to book space at subsidised rates, and will the community have a say in how it is run? We run activities for older residents and would love a home for them.', category: 'support', sentiment: 'positive', themes: [6, 5], daysAgo: 5 },
  { name: 'David Osei', email: 'd.osei@email.com', subject: 'Jobs for local people', message: 'Will there be a commitment to local jobs and apprenticeships during construction and in the new ground-floor retail and commercial units? Silvertown has high unemployment and Phase 1 should benefit residents first.', category: 'general', sentiment: 'positive', themes: [4], daysAgo: 3 },
]

// ---------------------------------------------------------------------------
// Stakeholder register + engagement log (best-effort — the table may not exist
// in every environment).
// ---------------------------------------------------------------------------
const STAKEHOLDERS = [
  { name: 'Silvertown Residents’ Association', type: 'community', category: 'undecided', email: 'chair@silvertownra.org', role: 'Residents’ association', notes: 'Key local voice. Concerned about height and parking on Plot 1J&C; supportive of the Silo D restoration and Silo D Park.', engagements: [ { type: 'meeting', summary: 'Introductory meeting — walked through Plot 1, Plot 1J&C and Silo D and the consultation timeline.', daysAgo: 50 }, { type: 'email', summary: 'Sent draft masterplan boards and invited comments on Plot 1J&C height.', daysAgo: 30 }, { type: 'meeting', summary: 'Follow-up on parking and CPZ concerns; agreed to feed into transport work.', daysAgo: 9 } ] },
  { name: 'Cllr Smith', type: 'authority', category: 'neutral', email: 'cllr.smith@newham.gov.uk', role: 'Ward councillor (Royal Docks)', notes: 'Wants cumulative infrastructure impacts across all three Phase 1 plots addressed together.', engagements: [ { type: 'meeting', summary: 'Briefing on the Phase 1 approach; stressed healthcare and transport capacity.', daysAgo: 40 }, { type: 'call', summary: 'Update call ahead of public drop-in.', daysAgo: 12 } ] },
  { name: 'Royal Docks Team (GLA/Newham)', type: 'authority', category: 'supporter', email: 'team@royaldocks.london', role: 'Regeneration partnership', notes: 'Broadly supportive; keen on the dock-edge public realm and the Silo D heritage outcome.', engagements: [ { type: 'meeting', summary: 'Design review of the Plot 1 gateway approach and the dock-edge public realm.', daysAgo: 34 } ] },
  { name: 'Silvertown Heritage Society', type: 'community', category: 'undecided', email: 'contact@silvertownheritage.org', role: 'Heritage group', notes: 'Supports restoration but wants cast-iron protection for Millennium Mills and Silo D.', engagements: [ { type: 'email', summary: 'Requested heritage statement and list of retained structures.', daysAgo: 37 }, { type: 'meeting', summary: 'Site walkover of Millennium Mills and Silo D; discussed which elements are retained.', daysAgo: 20 } ] },
  { name: 'Pontoon Dock Surgery', type: 'authority', category: 'opposed', email: 'h.marsh@nhs.net', role: 'Local GP practice', notes: 'Concerned about primary care capacity across Phase 1; open to hosting a branch surgery if space provided.', engagements: [ { type: 'enquiry', summary: 'Raised healthcare capacity concern via public enquiry; logged for HIA follow-up.', daysAgo: 41 } ] },
  { name: 'Royal Docks Traders Forum', type: 'business', category: 'supporter', email: 'info@rdtraders.org', role: 'Local business network', notes: 'Welcomes the ground-floor retail on Plot 1; wants a traders’ liaison group during construction.', engagements: [ { type: 'meeting', summary: 'Agreed to set up a traders’ liaison group for construction logistics.', daysAgo: 26 } ] },
  { name: 'Newham Cyclists', type: 'community', category: 'neutral', email: 'hello@newhamcyclists.org', role: 'Active travel group', notes: 'Pushing for generous cycle parking and a continuous dockside cycle route.', engagements: [ { type: 'email', summary: 'Shared active travel asks; invited to transport design workshop.', daysAgo: 22 } ] },
  { name: 'The Crown Estate', type: 'business', category: 'supporter', email: 'silvertown@thecrownestate.co.uk', role: 'Joint venture partner (Plot 1J&C)', notes: 'JV partner on Plot 1J&C; focused on the RMA due by March 2027 and delivery of Silo D Park.', engagements: [ { type: 'meeting', summary: 'JV coordination on Plot 1J&C RMA timeline and public-realm commitments.', daysAgo: 18 } ] },
]

// ---------------------------------------------------------------------------
// Corpus content helpers — MUST match src/lib/collect-feedback.ts exactly so
// the stored feedbackHash equals what the analytics route recomputes.
// ---------------------------------------------------------------------------
type Field = { id: string; label: string; type: string; options?: string[]; required?: boolean }

function formContent(data: Record<string, unknown>, fields: Field[]): string {
  const textContent = fields
    .filter(f => ['text', 'textarea'].includes(f.type))
    .map(f => {
      const value = data[f.id] ?? data[f.label]
      return value && typeof value === 'string' ? `${f.label}: ${value}` : null
    })
    .filter(Boolean)
    .join('. ')

  const directTextContent = Object.entries(data)
    .filter(([key, value]) => {
      const isFieldKey = fields.some(f => f.id === key || f.label === key)
      return typeof value === 'string' && (value as string).length > 10 && !isFieldKey
    })
    .map(([key, value]) => `${key}: ${value}`)
    .join('. ')

  return [textContent, directTextContent].filter(Boolean).join('. ')
}

// Replicates createFeedbackHash from src/lib/ai.ts exactly.
function createFeedbackHash(items: { id: string; content: string }[]): string {
  const content = items.map(item => `${item.id}:${item.content}`).sort().join('|')
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}

const QUOTE_CHARS = 160
const quote = (s: string) => (s.length > QUOTE_CHARS ? s.slice(0, QUOTE_CHARS) + '…' : s)

// ===========================================================================
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

async function main() {
  console.log('Seeding Silvertown Demo…')

  // --- clear any previous demo data (idempotent) --------------------------
  const existing = await prisma.project.findUnique({ where: { id: PROJECT_ID } })
  if (existing) {
    const forms = await prisma.feedbackForm.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })
    await prisma.feedbackResponse.deleteMany({ where: { formId: { in: forms.map(f => f.id) } } })
    await prisma.feedbackForm.deleteMany({ where: { projectId: PROJECT_ID } })
    await prisma.publicPin.deleteMany({ where: { projectId: PROJECT_ID } })
    await prisma.enquiry.deleteMany({ where: { projectId: PROJECT_ID } })
    // Keep plot zones — admins may have reshaped them in the Zones editor.
    await prisma.geoLayer.deleteMany({ where: { projectId: PROJECT_ID, type: { not: 'plot' } } })
    await prisma.imageOverlay.deleteMany({ where: { projectId: PROJECT_ID } })
    await prisma.mapMarker.deleteMany({ where: { projectId: PROJECT_ID } })
    await prisma.analysisResult.deleteMany({ where: { projectId: PROJECT_ID } })
    try {
      const shs = await (prisma as any).stakeholder.findMany({ where: { projectId: PROJECT_ID }, select: { id: true } })
      await (prisma as any).stakeholderEngagement.deleteMany({ where: { stakeholderId: { in: shs.map((s: any) => s.id) } } })
      await (prisma as any).stakeholder.deleteMany({ where: { projectId: PROJECT_ID } })
    } catch { /* stakeholder tables may not exist here */ }
    console.log('Cleared previous Silvertown Demo data')
  }

  // --- project ------------------------------------------------------------
  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: {
      name: 'Silvertown Demo',
      description: 'Phase 1 of the Silvertown Masterplan — Plot 1, Plot 1J&C and Silo D, on the south side of Royal Victoria Dock, E16. Demonstration consultation.',
      latitude: 51.5022,
      longitude: 0.0285,
      mapZoom: 16,
      status: 'LIVE',
      embedEnabled: true,
      allowPins: true,
      allowDrawing: true,
      embedPrimaryColor: '#0E7C86',
      embedFontFamily: 'Inter',
      embedDefaultSatellite: true,
    },
    create: {
      id: PROJECT_ID,
      name: 'Silvertown Demo',
      description: 'Phase 1 of the Silvertown Masterplan — Plot 1, Plot 1J&C and Silo D, on the south side of Royal Victoria Dock, E16. Demonstration consultation.',
      latitude: 51.5022,
      longitude: 0.0285,
      mapZoom: 16,
      status: 'LIVE',
      embedEnabled: true,
      allowPins: true,
      allowDrawing: true,
      embedPrimaryColor: '#0E7C86',
      embedFontFamily: 'Inter',
      embedDefaultSatellite: true,
    },
  })
  console.log('Project ready:', project.name, `(/embed/${project.id})`)

  // --- grant every super admin ADMIN access (best-effort) -----------------
  try {
    const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN' }, select: { id: true } })
    for (const a of admins) {
      await prisma.projectAccess.upsert({
        where: { userId_projectId: { userId: a.id, projectId: PROJECT_ID } },
        update: { role: 'ADMIN' },
        create: { userId: a.id, projectId: PROJECT_ID, role: 'ADMIN' },
      })
    }
    console.log(`Granted ADMIN access to ${admins.length} super admin(s)`)
  } catch (e) { console.warn('Could not grant project access:', (e as Error).message) }

  // --- plot boundaries as GeoLayers (admin map) ---------------------------
  // Zones are preserved across reseeds (admins can reshape them), so only create
  // ones that don't exist yet. Either way, capture each plot's current polygon
  // so pins can be scattered inside the actual shape.
  const zoneGeomByKey: Record<string, any> = {}
  const currentZones = await prisma.geoLayer.findMany({ where: { projectId: PROJECT_ID, type: 'plot' } })
  const zoneByKey = new Map<string, any>()
  for (const z of currentZones) {
    const gj: any = z.geojson
    const feat = gj?.type === 'FeatureCollection' ? gj.features?.[0] : gj
    const key = feat?.properties?.plot || z.name
    if (feat?.geometry) zoneByKey.set(key, feat.geometry)
  }
  let createdZones = 0
  for (const p of PLOTS) {
    if (zoneByKey.has(p.key)) {
      zoneGeomByKey[p.key] = zoneByKey.get(p.key)
      continue
    }
    const geometry = { type: 'Polygon', coordinates: [plotRing(p)] }
    await prisma.geoLayer.create({
      data: {
        projectId: PROJECT_ID,
        name: p.name,
        type: 'plot',
        geojson: { type: 'FeatureCollection', features: [ { type: 'Feature', properties: { name: p.name, plot: p.key, status: p.status, blurb: p.blurb }, geometry } ] },
        style: { fillColor: p.color, strokeColor: p.color, fillOpacity: 0.18, strokeWidth: 2 },
        visible: true,
      },
    })
    zoneGeomByKey[p.key] = geometry
    createdZones++
  }
  console.log(`Plot zones: ${createdZones} created, ${PLOTS.length - createdZones} preserved`)

  // --- collect corpus + assignments as we create rows ---------------------
  type CorpusRow = { id: string; content: string; type: 'pin' | 'form' | 'enquiry'; latitude: number | null; longitude: number | null; createdAt: Date; sentiment: Sent; themes: number[]; material: 'material' | 'non-material' | 'mixed'; source: 'pin' | 'form' | 'enquiry'; campaign?: boolean }
  const corpus: CorpusRow[] = []

  const themeIsMaterial = (t: number) => t !== 4 // jobs/economy often weighed less as a material planning consideration; everything else material here
  const materialFor = (themes: number[]): 'material' | 'non-material' | 'mixed' => {
    if (themes.length === 0) return 'non-material'
    const mat = themes.some(themeIsMaterial)
    const non = themes.some(t => !themeIsMaterial(t))
    return mat && non ? 'mixed' : mat ? 'material' : 'non-material'
  }

  // Zones are the GeoLayers above — the embed renders them directly and admins
  // edit them in the Zones tab, so no polygon "pins" are needed for the plots.

  // --- feedback pins ------------------------------------------------------
  // Scatter each pin inside its plot's current polygon (follows edited shapes).
  const rngByPlot: Record<string, () => number> = { '1': mulberry32(101), '1JC': mulberry32(202), 'D': mulberry32(303) }
  const plotIndex: Record<string, number> = { '1': 0, '1JC': 0, 'D': 0 }
  for (const seed of PINS) {
    const i = plotIndex[seed.plot]++
    const [lat, lng] = scatterInPolygon(zoneGeomByKey[seed.plot], rngByPlot[seed.plot])
    const createdAt = ago(seed.daysAgo)
    const row = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        shapeType: 'pin',
        latitude: lat,
        longitude: lng,
        category: seed.category,
        comment: seed.comment,
        name: `Resident ${100 + i + (seed.plot === '1' ? 0 : seed.plot === '1JC' ? 40 : 80)}`,
        approved: true,
        votes: seed.votes,
        gdprConsent: true,
        gdprConsentDate: createdAt,
        createdAt,
      },
    })
    corpus.push({ id: row.id, content: seed.comment, type: 'pin', latitude: lat, longitude: lng, createdAt, sentiment: seed.sentiment, themes: seed.themes, material: materialFor(seed.themes), source: 'pin' })
  }
  console.log(`Created ${PINS.length} feedback pins across three plots`)

  // --- organised campaign: near-identical template objections on Plot 1J&C --
  const campaignRng = mulberry32(404)
  for (let ci = 0; ci < CAMPAIGN_PERSONAL.length; ci++) {
    const [lat, lng] = scatterInPolygon(zoneGeomByKey['1JC'], campaignRng)
    const createdAt = ago(9 - ci) // a recent surge
    const comment = `${CAMPAIGN_TEMPLATE} ${CAMPAIGN_PERSONAL[ci]}`
    const row = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        shapeType: 'pin',
        latitude: lat,
        longitude: lng,
        category: 'negative',
        comment,
        name: `Resident ${400 + ci}`,
        approved: true,
        votes: 3 + ci,
        gdprConsent: true,
        gdprConsentDate: createdAt,
        createdAt,
      },
    })
    corpus.push({ id: row.id, content: comment, type: 'pin', latitude: lat, longitude: lng, createdAt, sentiment: 'negative', themes: [1], material: materialFor([1]), source: 'pin', campaign: true })
  }
  console.log(`Created ${CAMPAIGN_PERSONAL.length} campaign responses (Plot 1J&C parking template)`)

  // --- consultation survey ------------------------------------------------
  const surveyFields: Field[] = [
    { id: 'audience', label: 'Which best describes you?', type: 'radio', options: AUDIENCE_OPTIONS, required: true },
    { id: 'plot', label: 'Which part of the programme is your feedback mainly about?', type: 'radio', options: PLOT_OPTIONS, required: true },
    { id: 'support', label: 'Overall, do you support the emerging proposals?', type: 'radio', options: SUPPORT_OPTIONS, required: true },
    { id: 'likes', label: 'What do you like most about the proposals?', type: 'textarea', required: false },
    { id: 'concerns', label: 'What concerns do you have?', type: 'textarea', required: false },
    { id: 'suggestions', label: 'Any suggestions for improvement?', type: 'textarea', required: false },
  ]
  const survey = await prisma.feedbackForm.create({
    data: { projectId: PROJECT_ID, name: 'Silvertown Consultation Survey', active: true, fields: surveyFields },
  })
  for (const s of SURVEY) {
    const data = { audience: s.audience, plot: s.plot, support: s.support, likes: s.likes, concerns: s.concerns, suggestions: s.suggestions }
    const createdAt = ago(s.daysAgo)
    const resp = await prisma.feedbackResponse.create({
      data: { formId: survey.id, data, submittedAt: createdAt, gdprConsent: true, gdprConsentDate: createdAt },
    })
    const content = formContent(data, surveyFields)
    if (content) corpus.push({ id: resp.id, content, type: 'form', latitude: null, longitude: null, createdAt, sentiment: s.sentiment, themes: s.themes, material: materialFor(s.themes), source: 'form' })
  }
  console.log(`Created survey with ${SURVEY.length} responses`)

  // --- register for updates ----------------------------------------------
  const registerFields: Field[] = [
    { id: 'name', label: 'Your name', type: 'text', required: true },
    { id: 'email', label: 'Email address', type: 'email', required: true },
    { id: 'postcode', label: 'Postcode', type: 'text', required: false },
    { id: 'interest', label: 'What would you like updates about?', type: 'radio', options: REGISTER_INTERESTS, required: false },
    { id: 'plot', label: 'Which part of the programme interests you most?', type: 'radio', options: PLOT_OPTIONS, required: false },
  ]
  const register = await prisma.feedbackForm.create({
    data: { projectId: PROJECT_ID, name: 'Register for updates', active: true, fields: registerFields },
  })
  for (const r of REGISTRATIONS) {
    const createdAt = ago(r.daysAgo)
    // name & postcode are short (<=10) or captured as fields, so these never
    // enter the AI corpus — collectFeedback yields no text for them.
    await prisma.feedbackResponse.create({
      data: { formId: register.id, data: { name: r.name, email: r.email, postcode: r.postcode, interest: r.interest, plot: r.plot }, submittedAt: createdAt, gdprConsent: true, gdprConsentDate: createdAt },
    })
  }
  console.log(`Created register-for-updates form with ${REGISTRATIONS.length} signups`)

  // --- enquiries ----------------------------------------------------------
  for (const e of ENQUIRIES) {
    const createdAt = ago(e.daysAgo)
    const row = await prisma.enquiry.create({
      data: {
        projectId: PROJECT_ID,
        submitterName: e.name,
        submitterEmail: e.email,
        submitterOrg: e.org ?? null,
        submitterPhone: e.phone ?? null,
        subject: e.subject,
        message: e.message,
        category: e.category,
        status: e.daysAgo > 30 ? 'closed' : e.daysAgo > 10 ? 'open' : 'new',
        gdprConsent: true,
        gdprConsentDate: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    })
    const content = [e.subject, e.message].map(s => s?.trim()).filter(Boolean).join(': ')
    corpus.push({ id: row.id, content, type: 'enquiry', latitude: null, longitude: null, createdAt, sentiment: e.sentiment, themes: e.themes, material: materialFor(e.themes), source: 'enquiry' })
  }
  console.log(`Created ${ENQUIRIES.length} enquiries`)

  // --- stakeholders (best-effort) ----------------------------------------
  // influence / interest (1–5) per stakeholder, aligned to STAKEHOLDERS order,
  // spread across all four quadrants of the power/interest matrix.
  const II: [number, number][] = [[4, 5], [5, 4], [5, 3], [3, 5], [3, 4], [3, 4], [2, 4], [4, 3]]
  try {
    for (let si = 0; si < STAKEHOLDERS.length; si++) {
      const s = STAKEHOLDERS[si]
      const sh = await (prisma as any).stakeholder.create({
        data: { projectId: PROJECT_ID, name: s.name, organization: (s as any).org ?? null, type: s.type, category: s.category, email: s.email, role: (s as any).role ?? null, notes: s.notes, influence: II[si]?.[0] ?? null, interest: II[si]?.[1] ?? null },
      })
      for (const eng of s.engagements) {
        await (prisma as any).stakeholderEngagement.create({
          data: { stakeholderId: sh.id, type: eng.type, title: eng.summary, date: ago(eng.daysAgo) },
        })
      }
    }
    console.log(`Created ${STAKEHOLDERS.length} stakeholders with engagement log`)
  } catch (e) {
    console.warn('Skipped stakeholders (schema not present here):', (e as Error).message)
  }

  // =======================================================================
  // Build the AI analysis from the corpus, using the product's own maths.
  // =======================================================================
  const analysis = buildAnalysis(corpus)
  const feedbackHash = createFeedbackHash(corpus.map(c => ({ id: c.id, content: c.content })))

  await prisma.analysisResult.upsert({
    where: { projectId_type: { projectId: PROJECT_ID, type: 'full' } },
    update: { data: analysis as object, status: 'complete', feedbackHash, batchId: null, error: null },
    create: { projectId: PROJECT_ID, type: 'full', data: analysis as object, status: 'complete', feedbackHash },
  })
  console.log(`Stored AI analysis (${corpus.length} items, hash ${feedbackHash})`)

  console.log('\n✅ Silvertown Demo seeded.')
  console.log(`   Dashboard: /projects/${PROJECT_ID}`)
  console.log(`   Public embed: /embed/${PROJECT_ID}`)

  // ----- inner: assemble a FullAnalysisResult ----------------------------
  function buildAnalysis(rows: CorpusRow[]) {
    const taxonomy = TAXONOMY
    const assignments = rows.map(r => ({ id: r.id, sentiment: r.sentiment, confidence: 0.8 + ((r.themes.length * 7) % 15) / 100, themeIds: r.themes, material: r.material, materialCategories: r.material !== 'non-material' ? r.themes.filter(themeIsMaterial).map(t => taxonomy[t].name) : [], nonMaterialCategories: r.material !== 'material' ? r.themes.filter(t => !themeIsMaterial(t)).map(t => taxonomy[t].name) : [] }))

    // Real cross-reference maths — same code the live pipeline uses.
    const crItems: CrossRefItem[] = rows.map(r => ({ id: r.id, type: r.source, latitude: r.latitude, longitude: r.longitude, createdAt: r.createdAt }))
    const crAssign: CrossRefAssignment[] = rows.map(r => ({ id: r.id, sentiment: r.sentiment, themeIds: r.themes }))
    const crossRef = crossReference(crItems, taxonomy.map(t => ({ name: t.name })), crAssign, { areaPrecision: 3, minSegmentSize: 8, minCount: 3 })

    // Sentiment
    const count = (pred: (r: CorpusRow) => boolean) => rows.filter(pred).length
    const breakdown = { positive: count(r => r.sentiment === 'positive'), negative: count(r => r.sentiment === 'negative'), neutral: count(r => r.sentiment === 'neutral') }
    const bySrc = (src: CorpusRow['source']) => ({ positive: count(r => r.source === src && r.sentiment === 'positive'), negative: count(r => r.source === src && r.sentiment === 'negative'), neutral: count(r => r.source === src && r.sentiment === 'neutral') })
    const total = rows.length
    const sentiment = {
      overall: 'mixed' as const,
      score: Math.round(((breakdown.positive - breakdown.negative) / total) * 100) / 100,
      breakdown,
      bySource: { pins: bySrc('pin'), forms: bySrc('form'), enquiries: bySrc('enquiry') },
      items: assignments.map(a => ({ id: a.id, sentiment: a.sentiment, confidence: a.confidence })),
    }

    // Themes
    const themes = taxonomy.map((t, i) => {
      const members = rows.filter(r => r.themes.includes(i))
      const sb = { positive: members.filter(m => m.sentiment === 'positive').length, negative: members.filter(m => m.sentiment === 'negative').length, neutral: members.filter(m => m.sentiment === 'neutral').length }
      const dominant: 'positive' | 'negative' | 'neutral' | 'mixed' = sb.positive > 0 && sb.negative > 0 ? 'mixed' : sb.positive >= sb.negative && sb.positive >= sb.neutral ? 'positive' : sb.negative >= sb.neutral ? 'negative' : 'neutral'
      return { name: t.name, count: members.length, sentiment: dominant, keywords: t.keywords, sampleQuotes: members.slice(0, 3).map(m => quote(m.content)), sentimentBreakdown: sb }
    }).filter(t => t.count > 0).sort((a, b) => b.count - a.count)

    // Geographic clusters (~100m grid) from pins with coordinates.
    const grid = new Map<string, { lat: number; lng: number; pos: number; neg: number; neu: number; count: number; themes: Record<string, number> }>()
    rows.filter(r => r.latitude != null && r.longitude != null).forEach(r => {
      const key = `${r.latitude!.toFixed(3)},${r.longitude!.toFixed(3)}`
      if (!grid.has(key)) grid.set(key, { lat: r.latitude!, lng: r.longitude!, pos: 0, neg: 0, neu: 0, count: 0, themes: {} })
      const g = grid.get(key)!
      g.count++
      if (r.sentiment === 'positive') g.pos++; else if (r.sentiment === 'negative') g.neg++; else g.neu++
      r.themes.forEach(t => { const n = taxonomy[t].name; g.themes[n] = (g.themes[n] || 0) + 1 })
    })
    const clusters = Array.from(grid.values()).map(g => ({
      latitude: g.lat, longitude: g.lng,
      sentiment: (g.pos > 0 && g.neg > 0 ? 'mixed' : g.pos >= g.neg && g.pos >= g.neu ? 'positive' : g.neg >= g.neu ? 'negative' : 'neutral') as 'positive' | 'negative' | 'neutral' | 'mixed',
      count: g.count,
      themes: Object.entries(g.themes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
    }))

    // Spatial insights — one per plot, from real in-plot counts.
    const spatialInsights = PLOTS.map(p => {
      const inPlot = rows.filter(r => r.latitude != null && r.longitude != null && r.latitude! >= p.bounds.latMin && r.latitude! <= p.bounds.latMax && r.longitude! >= p.bounds.lngMin && r.longitude! <= p.bounds.lngMax)
      const areaTotal = inPlot.length || 1
      const themeCounts: Record<number, number> = {}
      inPlot.forEach(r => r.themes.forEach(t => { themeCounts[t] = (themeCounts[t] || 0) + 1 }))
      const topTheme = Number(Object.entries(themeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
      const themeCount = themeCounts[topTheme] || 0
      const pos = inPlot.filter(r => r.sentiment === 'positive').length
      const neg = inPlot.filter(r => r.sentiment === 'negative').length
      const dominant: 'positive' | 'negative' | 'neutral' | 'mixed' = pos > 0 && neg > 0 ? 'mixed' : pos >= neg ? 'positive' : 'negative'
      const headlineMap: Record<string, string> = {
        '1': `Feedback on Plot 1 is broadly supportive — the gateway design next to Millennium Mills, the dock-edge retail, and connectivity, with some concern about height and the lack of affordable homes.`,
        '1JC': `Plot 1J&C draws the strongest objections in Phase 1 — the 676-home density, height over Silo D Park and parking/DLR capacity dominate the responses here.`,
        'D': `Silo D attracts the most positive feedback, centred on restoring the listed building and creating Silo D Park for community use.`,
      }
      return {
        latitude: p.centroid[0], longitude: p.centroid[1], areaLabel: p.name,
        theme: taxonomy[topTheme].name, headline: headlineMap[p.key],
        quote: quote(inPlot.find(r => r.themes.includes(topTheme))?.content ?? ''),
        count: themeCount, areaTotal, share: Math.round((themeCount / areaTotal) * 100) / 100,
        baselineShare: 0.2, lift: Math.round(((themeCount / areaTotal) / 0.2) * 10) / 10, pValue: 0.01,
        dominantSentiment: dominant, responseIds: inPlot.filter(r => r.themes.includes(topTheme)).slice(0, 5).map(r => r.id),
      }
    })

    // Material considerations
    const materialAnalysis = {
      summary: { material: count(r => r.material === 'material'), nonMaterial: count(r => r.material === 'non-material'), mixed: count(r => r.material === 'mixed') },
      categories: {
        material: [0, 1, 2, 3, 5, 6, 7, 8].map(i => ({ name: taxonomy[i].name, count: rows.filter(r => r.themes.includes(i)).length, examples: rows.filter(r => r.themes.includes(i)).slice(0, 2).map(r => quote(r.content)) })).filter(c => c.count > 0),
        nonMaterial: [{ name: 'Jobs, workspace & local economy', count: rows.filter(r => r.themes.includes(4)).length, examples: rows.filter(r => r.themes.includes(4)).slice(0, 2).map(r => quote(r.content)) }].filter(c => c.count > 0),
      },
      items: assignments.map(a => ({ id: a.id, classification: a.material, materialCategories: a.materialCategories, nonMaterialCategories: a.nonMaterialCategories })),
    }

    // Campaign detection — the organised template objection on Plot B.
    const campaignRows = rows.filter(r => r.campaign)
    const campaignAnalysis = {
      totalAnalyzed: total,
      templatedCount: campaignRows.length,
      uniqueCount: total - campaignRows.length,
      campaigns: campaignRows.length >= 3 ? [{
        label: 'Parking & DLR capacity objection (Plot 1J&C)',
        count: campaignRows.length,
        stance: 'oppose' as const,
        templateSummary: '',
        personalAdditions: '',
        exact: false,
        sampleQuote: quote(campaignRows[0]?.content ?? ''),
        memberIds: campaignRows.map(r => r.id),
        responses: campaignRows.map(r => r.content),
      }] : [],
    }

    const headlineStats = {
      stats: [
        { text: `${total} pieces of feedback analysed across Plot 1, Plot 1J&C and Silo D`, type: 'insight' as const },
        { text: `Silo D (restoration + Silo D Park) is the most supported part of Phase 1`, type: 'support' as const },
        { text: `Height, density and parking on Plot 1J&C draw the strongest objections`, type: 'concern' as const },
        { text: `The Plot 1 gateway next to Millennium Mills has broad public backing`, type: 'support' as const },
        { text: `Cumulative transport and healthcare capacity is a recurring cross-programme concern`, type: 'concern' as const },
      ],
    }

    const summary = {
      executive: `Across Phase 1 of the Silvertown Masterplan — Plot 1, Plot 1J&C and Silo D — ${total} responses show a community that broadly welcomes the ambition but wants it delivered at the right scale and in the right order. Support is strongest for the Plot 1 gateway next to the Grade II listed Millennium Mills and for the restoration of the historic Silo D with the new Silo D Park. Opposition concentrates sharply on Plot 1J&C, where the density of the 676-home scheme, the height of the tallest blocks over Silo D Park, and parking and DLR capacity generate the most objections. Running through all three plots is a concern about cumulative impact — transport, DLR capacity and healthcare — which residents feel should be addressed across Phase 1 rather than plot by plot.`,
      keyFindings: [
        'Silo D attracts the most positive feedback, driven by restoring the listed building and creating Silo D Park for community use.',
        'Plot 1J&C is the flashpoint: 676-home density, height over Silo D Park and a low parking ratio dominate objections here.',
        'Plot 1 enjoys broad support as a gateway building next to Millennium Mills, though its all-private tenure and height draw some concern.',
        'Affordable housing levels on Plot 1J&C are widely felt to be too low for consented dock land, and Plot 1 has none.',
        'Cumulative infrastructure — transport, DLR capacity and healthcare — is the strongest cross-programme theme.',
      ],
      recommendations: [
        'Publish a Phase 1-wide transport and healthcare capacity plan spanning Plot 1, Plot 1J&C and Silo D.',
        'Revisit the massing and daylight impact of the tallest blocks on Plot 1J&C, particularly over Silo D Park.',
        'Confirm the Silo D planning strategy and commit in writing to delivering Silo D Park early in the phasing.',
        'Set out the affordable housing tenure split on Plot 1J&C and revisit the absence of affordable homes on Plot 1.',
        'Agree a construction logistics and liaison plan with local traders across the Phase 1 plots.',
      ],
      concernAreas: ['Height and density on Plot 1J&C', 'Parking and DLR capacity', 'Delivery phasing of Silo D Park', 'Affordable housing levels', 'Construction impact and hours'],
      supportAreas: ['Restoration of the listed Silo D', 'Silo D Park and public green space', 'The Plot 1 gateway next to Millennium Mills', 'Dock-edge retail and public access', 'Ground-floor activity on Spillers Street'],
    }

    return {
      sentiment, themes: { themes, totalFeedback: total }, summary,
      headlineStats, materialAnalysis, campaignAnalysis,
      geographic: { clusters }, crossReference: crossRef, spatialInsights,
      taxonomy, assignments,
      coverage: { total, analyzed: total, complete: true },
      analyzedAt: new Date().toISOString(), feedbackCount: total,
    }
  }
}
