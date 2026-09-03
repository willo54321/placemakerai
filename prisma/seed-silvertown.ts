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
  key: 'A' | 'B' | 'C'
  name: string
  blurb: string
  status: string
  color: string
  centroid: [number, number] // [lat, lng]
  bounds: { latMin: number; latMax: number; lngMin: number; lngMax: number }
}

const PLOTS: Plot[] = [
  {
    key: 'A',
    name: 'Plot A — Millennium Mills',
    blurb: 'Heritage-led restoration of the listed Millennium Mills and Silo D, delivering affordable workspace, makers’ studios and around 350 homes around a new dockside square.',
    status: 'Outline proposals — consultation open',
    color: '#0E7C86',
    centroid: [51.5016, 0.0205],
    bounds: { latMin: 51.5008, latMax: 51.5024, lngMin: 0.0188, lngMax: 0.0222 },
  },
  {
    key: 'B',
    name: 'Plot B — Dock Wharf',
    blurb: 'A new waterfront neighbourhood of around 620 homes, including family and affordable housing, with ground-floor shops and a dockside promenade.',
    status: 'Emerging masterplan — consultation open',
    color: '#2563EB',
    centroid: [51.5000, 0.0250],
    bounds: { latMin: 51.4992, latMax: 51.5008, lngMin: 0.0233, lngMax: 0.0267 },
  },
  {
    key: 'C',
    name: 'Plot C — Thameside Green',
    blurb: 'A two-acre public park, a community pavilion and a new two-form-entry primary school at the eastern end of the site, framed by low-rise homes.',
    status: 'Concept stage — early engagement',
    color: '#16A34A',
    centroid: [51.5022, 0.0300],
    bounds: { latMin: 51.5014, latMax: 51.5030, lngMin: 0.0283, lngMax: 0.0317 },
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

// Deterministic-ish point inside a plot, spread by index so 100m clusters split.
const pointIn = (p: Plot, i: number, n: number): [number, number] => {
  const { latMin, latMax, lngMin, lngMax } = p.bounds
  const fx = ((i * 2 + 1) % (n + 1)) / (n + 1)
  const fy = ((i * 3 + 2) % (n + 1)) / (n + 1)
  return [latMin + (latMax - latMin) * fy, lngMin + (lngMax - lngMin) * fx]
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
  // --- Plot A — Millennium Mills (heritage / workspace, broadly positive) ---
  { plot: 'A', category: 'positive', comment: 'Fantastic to see the Millennium Mills finally being brought back to life instead of rotting. The heritage matters.', sentiment: 'positive', themes: [5], votes: 24, daysAgo: 52 },
  { plot: 'A', category: 'positive', comment: 'Affordable workspace for makers is exactly what Silvertown needs. Please keep the rents genuinely affordable, not just "discounted".', sentiment: 'positive', themes: [4], votes: 19, daysAgo: 48 },
  { plot: 'A', category: 'positive', comment: 'The dockside square looks brilliant. Somewhere to actually sit by the water.', sentiment: 'positive', themes: [3, 5], votes: 15, daysAgo: 40 },
  { plot: 'A', category: 'negative', comment: 'Please do not let them demolish the silo. Once the industrial heritage is gone it never comes back.', sentiment: 'negative', themes: [5], votes: 31, daysAgo: 44 },
  { plot: 'A', category: 'question', comment: 'Which parts of the mills are actually listed and being kept, and which are being rebuilt?', sentiment: 'neutral', themes: [5], votes: 6, daysAgo: 30 },
  { plot: 'A', category: 'comment', comment: 'Would love a small heritage exhibition on the dock’s working history inside the restored mill.', sentiment: 'neutral', themes: [5], votes: 9, daysAgo: 26 },
  { plot: 'A', category: 'positive', comment: 'Great that some of the units are set aside for start-ups. That’s real local economy stuff.', sentiment: 'positive', themes: [4], votes: 12, daysAgo: 22 },
  { plot: 'A', category: 'negative', comment: 'Worried the "workspace" will just end up as expensive offices with none of it for local people.', sentiment: 'negative', themes: [4], votes: 14, daysAgo: 18 },
  { plot: 'A', category: 'question', comment: 'Will there be step-free access from Pontoon Dock DLR to the new square?', sentiment: 'neutral', themes: [1], votes: 5, daysAgo: 12 },
  { plot: 'A', category: 'comment', comment: 'The proposed brick and steel palette is sympathetic to the industrial character. Well judged.', sentiment: 'positive', themes: [2, 5], votes: 8, daysAgo: 9 },
  { plot: 'A', category: 'negative', comment: 'Construction lorries down North Woolwich Road are already a nightmare. How much worse will this make it?', sentiment: 'negative', themes: [7, 1], votes: 17, daysAgo: 6 },
  { plot: 'A', category: 'positive', comment: 'Reopening the dock edge to the public is the single best thing in these plans.', sentiment: 'positive', themes: [3, 5], votes: 21, daysAgo: 4 },
  { plot: 'A', category: 'comment', comment: 'Please include some genuinely family-sized homes here, not just studios and one-beds.', sentiment: 'neutral', themes: [0], votes: 11, daysAgo: 3 },
  { plot: 'A', category: 'question', comment: 'What are the proposed building heights next to the listed mill?', sentiment: 'neutral', themes: [2, 5], votes: 4, daysAgo: 2 },

  // --- Plot B — Dock Wharf (waterfront homes, height/density, more mixed) ---
  { plot: 'B', category: 'negative', comment: 'Twenty-six storeys is far too tall for the waterfront. It will wall off the dock and overshadow everything.', sentiment: 'negative', themes: [2], votes: 38, daysAgo: 50 },
  { plot: 'B', category: 'negative', comment: '620 homes and only 90 parking spaces? Where is everyone supposed to park? The side streets are already full.', sentiment: 'negative', themes: [1], votes: 42, daysAgo: 49 },
  { plot: 'B', category: 'negative', comment: 'Density is just too high. This is a suburb being turned into Manhattan.', sentiment: 'negative', themes: [2], votes: 27, daysAgo: 46 },
  { plot: 'B', category: 'positive', comment: 'We badly need more homes and this is right next to the DLR. Build them.', sentiment: 'positive', themes: [0, 1], votes: 23, daysAgo: 45 },
  { plot: 'B', category: 'negative', comment: 'Only 25% affordable is not good enough for public dock land. Should be 50%.', sentiment: 'negative', themes: [0], votes: 34, daysAgo: 41 },
  { plot: 'B', category: 'positive', comment: 'The dockside promenade and cafes would transform this dead stretch of water. Yes please.', sentiment: 'positive', themes: [3], votes: 18, daysAgo: 38 },
  { plot: 'B', category: 'question', comment: 'What is the affordable housing split between social rent and shared ownership?', sentiment: 'neutral', themes: [0], votes: 7, daysAgo: 33 },
  { plot: 'B', category: 'negative', comment: 'The towers will cast the whole promenade into shadow every afternoon. Has a daylight study been done?', sentiment: 'negative', themes: [2, 3], votes: 20, daysAgo: 28 },
  { plot: 'B', category: 'comment', comment: 'If you step the heights down towards the existing houses it would be far more acceptable.', sentiment: 'neutral', themes: [2], votes: 16, daysAgo: 24 },
  { plot: 'B', category: 'negative', comment: 'The DLR is already crammed at rush hour. Adding thousands of residents with no transport upgrade is reckless.', sentiment: 'negative', themes: [1], votes: 29, daysAgo: 20 },
  { plot: 'B', category: 'positive', comment: 'Really like that the ground floors are shops and not blank walls. Makes it feel like a place.', sentiment: 'positive', themes: [4, 2], votes: 10, daysAgo: 15 },
  { plot: 'B', category: 'question', comment: 'Will the promenade be publicly accessible 24/7 or gated for residents only?', sentiment: 'neutral', themes: [3], votes: 8, daysAgo: 11 },
  { plot: 'B', category: 'negative', comment: 'Flood risk on the dock edge worries me. What happens with rising river levels in 30 years?', sentiment: 'negative', themes: [8], votes: 13, daysAgo: 7 },
  { plot: 'B', category: 'comment', comment: 'Please make sure there is proper cycle parking, not a token rack for 600 homes.', sentiment: 'neutral', themes: [1, 8], votes: 9, daysAgo: 5 },
  { plot: 'B', category: 'negative', comment: 'My flat will be directly overlooked by the tallest block. This will devalue our home.', sentiment: 'negative', themes: [2], votes: 15, daysAgo: 2 },

  // --- Plot C — Thameside Green (park / school / community, mostly positive) ---
  { plot: 'C', category: 'positive', comment: 'A proper two-acre park is exactly what this end of Silvertown is missing. Brilliant.', sentiment: 'positive', themes: [3], votes: 33, daysAgo: 47 },
  { plot: 'C', category: 'positive', comment: 'A new primary school is desperately needed. Ours is oversubscribed and we’re on the waiting list.', sentiment: 'positive', themes: [6], votes: 28, daysAgo: 43 },
  { plot: 'C', category: 'positive', comment: 'The community pavilion could be amazing if it’s genuinely for community use and not hired out to the highest bidder.', sentiment: 'positive', themes: [6, 3], votes: 17, daysAgo: 37 },
  { plot: 'C', category: 'question', comment: 'When would the park actually open? Would it be first or last in the phasing?', sentiment: 'neutral', themes: [3, 7], votes: 12, daysAgo: 31 },
  { plot: 'C', category: 'negative', comment: 'Worried the park will be delivered last, years after the flats, like every other scheme round here.', sentiment: 'negative', themes: [7, 3], votes: 24, daysAgo: 29 },
  { plot: 'C', category: 'positive', comment: 'Please include a proper playground for older kids, not just toddlers. Teenagers have nowhere to go.', sentiment: 'positive', themes: [3, 6], votes: 14, daysAgo: 25 },
  { plot: 'C', category: 'comment', comment: 'Native planting and a wetland edge would be great for biodiversity and the kids’ nature lessons.', sentiment: 'neutral', themes: [8, 3], votes: 11, daysAgo: 19 },
  { plot: 'C', category: 'positive', comment: 'Low-rise homes framing the park is the right scale here. Much better than the towers on Plot B.', sentiment: 'positive', themes: [2, 3], votes: 16, daysAgo: 16 },
  { plot: 'C', category: 'question', comment: 'Will the school have a nursery / early years places attached?', sentiment: 'neutral', themes: [6], votes: 6, daysAgo: 13 },
  { plot: 'C', category: 'negative', comment: 'Construction next to a new school worries me — dust and lorries around children needs a real plan.', sentiment: 'negative', themes: [7, 6], votes: 13, daysAgo: 8 },
  { plot: 'C', category: 'positive', comment: 'Good access to the park from the existing estate too, not just the new homes, please.', sentiment: 'positive', themes: [3], votes: 10, daysAgo: 5 },
  { plot: 'C', category: 'comment', comment: 'A weekly market or events on the green would really bring the community together.', sentiment: 'neutral', themes: [6, 4], votes: 8, daysAgo: 3 },
  { plot: 'C', category: 'positive', comment: 'Genuinely encouraged that you’re engaging this early on Plot C. Keep listening.', sentiment: 'positive', themes: [6], votes: 9, daysAgo: 1 },
]

// ---------------------------------------------------------------------------
// Visitor-drawn shapes — lines (routes) and polygons (areas) — so the "by map
// shape" breakdown is populated with genuine feedback, not just point pins.
// ---------------------------------------------------------------------------
type ShapeSeed = {
  shapeType: 'line' | 'polygon'
  geometry: any
  category: 'positive' | 'negative' | 'question' | 'comment'
  comment: string
  sentiment: Sent
  themes: number[]
  votes: number
  daysAgo: number
}

const SHAPES: ShapeSeed[] = [
  { shapeType: 'line', geometry: { type: 'LineString', coordinates: [[0.0206, 51.5017], [0.0211, 51.5012], [0.0216, 51.5008]] }, category: 'negative', comment: 'The walk from Pontoon Dock DLR to Plot A has no safe crossing on North Woolwich Road. This route needs a proper pedestrian crossing.', sentiment: 'negative', themes: [1], votes: 16, daysAgo: 23 },
  { shapeType: 'line', geometry: { type: 'LineString', coordinates: [[0.0205, 51.5016], [0.0250, 51.5002], [0.0300, 51.5022]] }, category: 'positive', comment: 'A continuous cycle route along the dockside would connect all three plots beautifully. Please make this a spine of the masterplan.', sentiment: 'positive', themes: [1, 8], votes: 19, daysAgo: 14 },
  { shapeType: 'polygon', geometry: { type: 'Polygon', coordinates: [[[0.0240, 51.4996], [0.0248, 51.4996], [0.0248, 51.5000], [0.0240, 51.5000], [0.0240, 51.4996]]] }, category: 'negative', comment: 'This corner by Dock Wharf floods badly after heavy rain. Please design the drainage out before building homes here.', sentiment: 'negative', themes: [8], votes: 12, daysAgo: 17 },
  { shapeType: 'polygon', geometry: { type: 'Polygon', coordinates: [[[0.0300, 51.5024], [0.0308, 51.5024], [0.0308, 51.5028], [0.0300, 51.5028], [0.0300, 51.5024]]] }, category: 'positive', comment: 'This would be a great spot for community growing space or allotments alongside the new park on Plot C.', sentiment: 'positive', themes: [3, 6], votes: 14, daysAgo: 8 },
]

// ---------------------------------------------------------------------------
// Consultation survey responses. Fields chosen so the audience + plot cuts work.
// ---------------------------------------------------------------------------
const AUDIENCE_OPTIONS = ['Local resident', 'Business / worker', 'Community group', 'Landowner / developer', 'Visitor', 'Other']
const PLOT_OPTIONS = ['Plot A — Millennium Mills', 'Plot B — Dock Wharf', 'Plot C — Thameside Green', 'The whole programme']
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
  { audience: 'Local resident', plot: PLOT_OPTIONS[0], support: 'Strongly support', likes: 'Restoring the Millennium Mills and opening the dock edge to the public is exactly what we need.', concerns: 'Just make sure the affordable workspace stays affordable in ten years’ time.', suggestions: 'A heritage trail along the dock explaining the site’s history.', sentiment: 'positive', themes: [5, 4], daysAgo: 51 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'The promenade idea is nice.', concerns: 'The towers are far too tall and there is nowhere near enough parking for 620 homes.', suggestions: 'Reduce the height to a maximum of twelve storeys and provide one space per home.', sentiment: 'negative', themes: [2, 1], daysAgo: 50 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'Affordable studios for makers and small businesses would be transformational for the area.', concerns: 'Construction disruption to existing businesses on North Woolwich Road.', suggestions: 'Phase the works so the road isn’t closed for years.', sentiment: 'positive', themes: [4, 7], daysAgo: 46 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'A park and a primary school. Finally. Both are desperately needed at this end.', concerns: 'That the park and school arrive years after the flats.', suggestions: 'Commit to delivering the park in the first phase, in writing.', sentiment: 'positive', themes: [3, 6, 7], daysAgo: 45 },
  { audience: 'Community group', plot: PLOT_OPTIONS[3], support: 'Neutral', likes: 'Ambition is good and the heritage approach on Plot A is sensitive.', concerns: 'Cumulative traffic and school places across all three plots have not been addressed together.', suggestions: 'Publish a programme-wide transport and school-places plan, not three separate ones.', sentiment: 'neutral', themes: [1, 6], daysAgo: 42 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Strongly oppose', likes: 'Honestly very little.', concerns: 'Overdevelopment, loss of light to existing homes, and pressure on GP surgeries that are already full.', suggestions: 'Go back and design something at a human scale.', sentiment: 'negative', themes: [2, 6], daysAgo: 41 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Support', likes: 'We need the homes and it’s right by the DLR.', concerns: 'Affordable housing should be higher than 25%.', suggestions: 'Push the affordable share to at least 40% social rent.', sentiment: 'positive', themes: [0], daysAgo: 38 },
  { audience: 'Visitor', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'I’d come to Silvertown for a restored dockside with cafes and workspace. Great destination potential.', concerns: 'Keep some of the raw industrial character, don’t over-polish it.', suggestions: 'Retain the crane and silo as landmarks.', sentiment: 'positive', themes: [5, 4], daysAgo: 35 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Support', likes: 'The community pavilion and green space.', concerns: 'Will the pavilion be genuinely affordable for local groups to book?', suggestions: 'Ring-fence subsidised community hours in the pavilion.', sentiment: 'positive', themes: [6, 3], daysAgo: 33 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[1], support: 'Neutral', likes: 'Ground-floor retail could bring footfall.', concerns: 'Construction access and loss of parking for customers during the build.', suggestions: 'A construction logistics plan agreed with local traders.', sentiment: 'neutral', themes: [7, 1], daysAgo: 30 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'Nothing about the height.', concerns: 'Twenty-six storeys will overshadow the promenade every afternoon.', suggestions: 'Commission and publish a daylight and sunlight study.', sentiment: 'negative', themes: [2, 3], daysAgo: 27 },
  { audience: 'Community group', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'Early engagement on Plot C is welcome and the school is vital.', concerns: 'Dust and HGV movements next to a new school.', suggestions: 'A dedicated construction management plan around the school.', sentiment: 'positive', themes: [6, 7], daysAgo: 24 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[0], support: 'Support', likes: 'Sympathetic restoration of the mills and new jobs.', concerns: 'Building heights right next to the listed structures.', suggestions: 'Keep new blocks lower than the mill roofline.', sentiment: 'positive', themes: [5, 2], daysAgo: 21 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[3], support: 'Neutral', likes: 'Some good ideas across the plots.', concerns: 'Flood risk and drainage on reclaimed dock land over the long term.', suggestions: 'Independent flood modelling published for consultation.', sentiment: 'neutral', themes: [8], daysAgo: 18 },
  { audience: 'Landowner / developer', plot: PLOT_OPTIONS[3], support: 'Support', likes: 'A coordinated masterplan across the three plots is the right approach.', concerns: 'Certainty on infrastructure timing to support delivery.', suggestions: 'A clear phasing and infrastructure trigger schedule.', sentiment: 'positive', themes: [7, 1], daysAgo: 16 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Oppose', likes: 'The homes are needed in principle.', concerns: 'But not at this density with no transport upgrade. The DLR cannot cope.', suggestions: 'Fund a DLR frequency increase as part of the scheme.', sentiment: 'negative', themes: [1, 2], daysAgo: 13 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[2], support: 'Strongly support', likes: 'The park, the school, and the lower-rise homes. All good.', concerns: 'Just deliver the park early.', suggestions: 'Park first, please.', sentiment: 'positive', themes: [3, 6], daysAgo: 10 },
  { audience: 'Business / worker', plot: PLOT_OPTIONS[0], support: 'Strongly support', likes: 'Affordable maker workspace is a real draw and will keep small firms in the area.', concerns: 'Rent levels once it opens.', suggestions: 'Cap workspace rents at a genuinely affordable level for a fixed period.', sentiment: 'positive', themes: [4], daysAgo: 7 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[1], support: 'Neutral', likes: 'Promenade and shops.', concerns: 'Overlooking and privacy for existing residents.', suggestions: 'Greater set-backs from existing homes.', sentiment: 'neutral', themes: [2], daysAgo: 4 },
  { audience: 'Local resident', plot: PLOT_OPTIONS[3], support: 'Support', likes: 'Overall the programme could be great for Silvertown if it’s done properly.', concerns: 'Keeping the community informed as it moves through each phase.', suggestions: 'Regular updates and keep this map open throughout.', sentiment: 'positive', themes: [6], daysAgo: 2 },
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
  { name: 'Sandra Okoro', email: 'sandra.okoro@email.com', subject: 'Parking permits for existing residents', org: undefined, phone: '07700 900123', message: 'I have lived on Evelyn Road for 20 years. With 620 new homes on Plot B and almost no parking, where will the new residents park? On our streets. What protection is there for existing residents — will there be a controlled parking zone?', category: 'objection', sentiment: 'negative', themes: [1], daysAgo: 48 },
  { name: 'Royal Docks Traders Forum', email: 'info@rdtraders.org', org: 'Royal Docks Traders Forum', subject: 'Support and construction logistics for local businesses', message: 'On behalf of local traders we broadly welcome the affordable workspace on Plot A. However we need a construction logistics plan that keeps North Woolwich Road open and protects footfall during the build. Can we meet to discuss a traders’ liaison group?', category: 'general', sentiment: 'positive', themes: [4, 7], daysAgo: 44 },
  { name: 'Dr Helen Marsh', email: 'h.marsh@nhs.net', org: 'Pontoon Dock Surgery', subject: 'Healthcare capacity across the programme', message: 'As a local GP I am concerned that the cumulative impact of all three plots on primary care has not been assessed. Our list is already at capacity. Has a health impact assessment been done for the whole programme, and is space allocated for a branch surgery?', category: 'planning', sentiment: 'negative', themes: [6], daysAgo: 41 },
  { name: 'Silvertown Heritage Society', email: 'contact@silvertownheritage.org', org: 'Silvertown Heritage Society', subject: 'Protection of the listed mills and silo', message: 'We strongly support restoration but need clarity on exactly which structures are retained. The Grade II* Millennium Mills and Silo D must be protected in full. We request a meeting and sight of the heritage statement.', category: 'planning', sentiment: 'neutral', themes: [5], daysAgo: 37 },
  { name: 'James Whitfield', email: 'j.whitfield@outlook.com', subject: 'Building heights on Plot B', message: 'Twenty-six storeys on the waterfront is completely out of character. Has a daylight and sunlight assessment been carried out for neighbouring homes and the promenade? I would like to see it before the next stage.', category: 'objection', sentiment: 'negative', themes: [2, 3], daysAgo: 32 },
  { name: 'Grace Adeyemi', email: 'grace.a@gmail.com', subject: 'School places and the new primary', message: 'We are delighted about the proposed primary school on Plot C. Can you confirm the entry size, whether there will be nursery places, and when it would open relative to the homes being occupied?', category: 'support', sentiment: 'positive', themes: [6], daysAgo: 28 },
  { name: 'Newham Cyclists', email: 'hello@newhamcyclists.org', org: 'Newham Cyclists', subject: 'Active travel and cycle parking', message: 'Please ensure secure, generous cycle parking across all three plots and a continuous cycle route along the dockside. Token provision for 600+ homes will not do. We would welcome involvement in the transport design.', category: 'general', sentiment: 'neutral', themes: [1, 8], daysAgo: 24 },
  { name: 'Michael Brennan', email: 'm.brennan@email.com', subject: 'Construction hours and night shifts', message: 'I work nights at the hospital. The proposed 7am start for construction will make it impossible to sleep. Please confirm the working hours, weekend policy and how noise will be controlled, especially near Plot C.', category: 'complaint', sentiment: 'negative', themes: [7], daysAgo: 19 },
  { name: 'Priya Nair', email: 'priya.nair@email.com', subject: 'Affordable housing tenure', message: 'Can you set out the affordable housing tenure split for Plot B? How much is social rent versus shared ownership, and how were the income thresholds set? 25% overall feels low for public dock land.', category: 'planning', sentiment: 'negative', themes: [0], daysAgo: 15 },
  { name: 'Thames Estuary Partnership', email: 'info@thamesestuary.org', org: 'Thames Estuary Partnership', subject: 'Flood resilience and biodiversity', message: 'We would like to understand the flood resilience strategy for the dock edge and how biodiversity net gain will be delivered, particularly the wetland edge suggested for the Plot C park. Please share the environmental documents.', category: 'general', sentiment: 'neutral', themes: [8, 3], daysAgo: 11 },
  { name: 'Anthony Cole', email: 'a.cole@email.com', subject: 'Overlooking and privacy', message: 'My flat directly faces the tallest proposed block on Plot B. I am very concerned about overlooking and loss of privacy. What set-back distances are proposed and will there be screening?', category: 'objection', sentiment: 'negative', themes: [2], daysAgo: 8 },
  { name: 'Ruth Bello', email: 'ruth.bello@email.com', org: 'Silvertown Community Network', subject: 'Community pavilion booking', message: 'The community pavilion on Plot C is a great idea. Will local groups be able to book it at subsidised rates, and will the community have a say in how it is run? We run activities for older residents and would love a home for them.', category: 'support', sentiment: 'positive', themes: [6, 3], daysAgo: 5 },
  { name: 'David Osei', email: 'd.osei@email.com', subject: 'Jobs for local people', message: 'Will there be a commitment to local jobs and apprenticeships during construction and in the new workspace? Silvertown has high unemployment and this programme should benefit residents first.', category: 'general', sentiment: 'positive', themes: [4], daysAgo: 3 },
]

// ---------------------------------------------------------------------------
// Stakeholder register + engagement log (best-effort — the table may not exist
// in every environment).
// ---------------------------------------------------------------------------
const STAKEHOLDERS = [
  { name: 'Silvertown Residents’ Association', type: 'community', category: 'undecided', email: 'chair@silvertownra.org', role: 'Residents’ association', notes: 'Key local voice. Concerned about height and parking on Plot B; supportive of park and school on Plot C.', engagements: [ { type: 'meeting', summary: 'Introductory meeting — walked through the three plots and the consultation timeline.', daysAgo: 50 }, { type: 'email', summary: 'Sent draft masterplan boards and invited comments on Plot B height.', daysAgo: 30 }, { type: 'meeting', summary: 'Follow-up on parking and CPZ concerns; agreed to feed into transport work.', daysAgo: 9 } ] },
  { name: 'Cllr Farida Hussain', type: 'authority', category: 'neutral', email: 'farida.hussain@newham.gov.uk', role: 'Ward councillor (Royal Docks)', notes: 'Wants cumulative infrastructure impacts across all three plots addressed together.', engagements: [ { type: 'meeting', summary: 'Briefing on programme-wide approach; stressed schools and GP capacity.', daysAgo: 40 }, { type: 'call', summary: 'Update call ahead of public drop-in.', daysAgo: 12 } ] },
  { name: 'Royal Docks Team (GLA/Newham)', type: 'authority', category: 'supporter', email: 'team@royaldocks.london', role: 'Regeneration partnership', notes: 'Broadly supportive; keen on affordable workspace and public realm outcomes.', engagements: [ { type: 'meeting', summary: 'Design review of Plot A heritage approach and dock-edge public realm.', daysAgo: 34 } ] },
  { name: 'Silvertown Heritage Society', type: 'community', category: 'undecided', email: 'contact@silvertownheritage.org', role: 'Heritage group', notes: 'Supports restoration but wants cast-iron protection for the listed mills and silo.', engagements: [ { type: 'email', summary: 'Requested heritage statement and list of retained structures.', daysAgo: 37 }, { type: 'meeting', summary: 'Site walkover of the mills; discussed which elements are retained.', daysAgo: 20 } ] },
  { name: 'Pontoon Dock Surgery', type: 'authority', category: 'opposed', email: 'h.marsh@nhs.net', role: 'Local GP practice', notes: 'Concerned about primary care capacity; open to hosting a branch surgery if space provided.', engagements: [ { type: 'enquiry', summary: 'Raised healthcare capacity concern via public enquiry; logged for HIA follow-up.', daysAgo: 41 } ] },
  { name: 'Royal Docks Traders Forum', type: 'business', category: 'supporter', email: 'info@rdtraders.org', role: 'Local business network', notes: 'Welcomes affordable workspace; wants a traders’ liaison group during construction.', engagements: [ { type: 'meeting', summary: 'Agreed to set up a traders’ liaison group for construction logistics.', daysAgo: 26 } ] },
  { name: 'Newham Cyclists', type: 'community', category: 'neutral', email: 'hello@newhamcyclists.org', role: 'Active travel group', notes: 'Pushing for generous cycle parking and a continuous dockside cycle route.', engagements: [ { type: 'email', summary: 'Shared active travel asks; invited to transport design workshop.', daysAgo: 22 } ] },
  { name: 'Thameside Green Primary (proposed)', type: 'authority', category: 'supporter', email: 'admissions@newham.gov.uk', role: 'Education / school places', notes: 'Two-form-entry primary proposed on Plot C; strong local need.', engagements: [ { type: 'meeting', summary: 'Discussed entry size, nursery places and delivery phasing.', daysAgo: 18 } ] },
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
    await prisma.geoLayer.deleteMany({ where: { projectId: PROJECT_ID } })
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
      description: 'A three-plot regeneration programme on the Silvertown dockside, Royal Docks, E16. Demonstration consultation.',
      latitude: 51.5012,
      longitude: 0.0253,
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
      description: 'A three-plot regeneration programme on the Silvertown dockside, Royal Docks, E16. Demonstration consultation.',
      latitude: 51.5012,
      longitude: 0.0253,
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
  for (const p of PLOTS) {
    await prisma.geoLayer.create({
      data: {
        projectId: PROJECT_ID,
        name: p.name,
        type: 'plot',
        geojson: {
          type: 'FeatureCollection',
          features: [ { type: 'Feature', properties: { name: p.name, plot: p.key, status: p.status }, geometry: { type: 'Polygon', coordinates: [plotRing(p)] } } ],
        },
        style: { fillColor: p.color, strokeColor: p.color, fillOpacity: 0.18, strokeWidth: 2 },
        visible: true,
      },
    })
  }
  console.log(`Created ${PLOTS.length} plot boundary layers`)

  // --- collect corpus + assignments as we create rows ---------------------
  type CorpusRow = { id: string; content: string; type: 'pin' | 'form' | 'enquiry'; latitude: number | null; longitude: number | null; createdAt: Date; sentiment: Sent; themes: number[]; material: 'material' | 'non-material' | 'mixed'; source: 'pin' | 'form' | 'enquiry' }
  const corpus: CorpusRow[] = []

  const themeIsMaterial = (t: number) => t !== 4 // jobs/economy often weighed less as a material planning consideration; everything else material here
  const materialFor = (themes: number[]): 'material' | 'non-material' | 'mixed' => {
    if (themes.length === 0) return 'non-material'
    const mat = themes.some(themeIsMaterial)
    const non = themes.some(t => !themeIsMaterial(t))
    return mat && non ? 'mixed' : mat ? 'material' : 'non-material'
  }

  // --- plot polygon pins for the public embed (clickable info) ------------
  for (const p of PLOTS) {
    const pin = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        shapeType: 'polygon',
        latitude: null,
        longitude: null,
        geometry: { type: 'Polygon', coordinates: [plotRing(p)] },
        category: 'comment',
        comment: `${p.name}. ${p.blurb} (${p.status})`,
        name: 'Silvertown programme team',
        approved: true,
        votes: 0,
        gdprConsent: true,
        gdprConsentDate: ago(56),
        createdAt: ago(56),
      },
    })
    // Plot markers join the corpus (approved pins do) but carry no theme, so
    // they don't skew theme counts. Neutral, no coordinates.
    corpus.push({ id: pin.id, content: pin.comment, type: 'pin', latitude: null, longitude: null, createdAt: ago(56), sentiment: 'neutral', themes: [], material: 'non-material', source: 'pin' })
  }

  // --- feedback pins ------------------------------------------------------
  const perPlotCount: Record<string, number> = {}
  PINS.forEach(pin => { perPlotCount[pin.plot] = (perPlotCount[pin.plot] || 0) + 1 })
  const plotIndex: Record<string, number> = { A: 0, B: 0, C: 0 }
  for (const seed of PINS) {
    const plot = PLOTS.find(p => p.key === seed.plot)!
    const i = plotIndex[seed.plot]++
    const [lat, lng] = pointIn(plot, i, perPlotCount[seed.plot])
    const createdAt = ago(seed.daysAgo)
    const row = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        shapeType: 'pin',
        latitude: lat,
        longitude: lng,
        category: seed.category,
        comment: seed.comment,
        name: `Resident ${100 + i + (seed.plot.charCodeAt(0) - 65) * 40}`,
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

  // --- visitor-drawn shapes (routes & areas) ------------------------------
  for (let si = 0; si < SHAPES.length; si++) {
    const sh = SHAPES[si]
    const createdAt = ago(sh.daysAgo)
    const row = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        shapeType: sh.shapeType,
        latitude: null,
        longitude: null,
        geometry: sh.geometry,
        category: sh.category,
        comment: sh.comment,
        name: `Resident ${300 + si}`,
        approved: true,
        votes: sh.votes,
        gdprConsent: true,
        gdprConsentDate: createdAt,
        createdAt,
      },
    })
    corpus.push({ id: row.id, content: sh.comment, type: 'pin', latitude: null, longitude: null, createdAt, sentiment: sh.sentiment, themes: sh.themes, material: materialFor(sh.themes), source: 'pin' })
  }
  console.log(`Created ${SHAPES.length} drawn shapes (routes & areas)`)

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
        A: `Feedback on Plot A concentrates on heritage and the restoration of the mills, and is broadly supportive.`,
        B: `Plot B draws the strongest objections in the whole programme — height, density and parking dominate the responses here.`,
        C: `Plot C attracts the most positive feedback, centred on the new park, school and community facilities.`,
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

    // Campaign detection — one small organised push on parking (Plot B).
    const parkingIds = rows.filter(r => r.themes.includes(1) && r.sentiment === 'negative').slice(0, 5).map(r => r.id)
    const campaignAnalysis = {
      totalAnalyzed: total,
      templatedCount: parkingIds.length,
      uniqueCount: total - parkingIds.length,
      campaigns: parkingIds.length >= 3 ? [{ label: 'Parking & transport objections (Plot B)', count: parkingIds.length, stance: 'oppose' as const, templateSummary: 'A cluster of responses raising the same parking-provision and DLR-capacity objection to Plot B, several with near-identical wording.', personalAdditions: 'Most add a specific street or personal circumstance.', exact: false, sampleQuote: quote(rows.find(r => parkingIds.includes(r.id))?.content ?? ''), memberIds: parkingIds }] : [],
    }

    const headlineStats = {
      stats: [
        { text: `${total} pieces of feedback analysed across all three plots`, type: 'insight' as const },
        { text: `Plot C (park, school, community) is the most supported part of the programme`, type: 'support' as const },
        { text: `Height, density and parking on Plot B draw the strongest objections`, type: 'concern' as const },
        { text: `Heritage restoration on Plot A has broad public backing`, type: 'support' as const },
        { text: `Cumulative traffic and school-place capacity is a recurring cross-programme concern`, type: 'concern' as const },
      ],
    }

    const summary = {
      executive: `Across the Silvertown programme, ${total} responses show a community that broadly welcomes the ambition but wants it delivered at the right scale and in the right order. Support is strongest for the heritage-led restoration of the Millennium Mills on Plot A and for the park, primary school and community facilities proposed on Plot C. Opposition concentrates sharply on Plot B, where the height and density of the waterfront towers and the level of parking provision generate the most objections. Running through all three plots is a concern about cumulative impact — traffic, DLR capacity and school and GP places — which residents feel should be addressed programme-wide rather than plot by plot.`,
      keyFindings: [
        'Plot C (Thameside Green) attracts the most positive feedback, driven by the new park, primary school and community pavilion.',
        'Plot B (Dock Wharf) is the flashpoint: 26-storey heights, density and a low parking ratio dominate objections here.',
        'Plot A (Millennium Mills) enjoys broad support for heritage restoration and affordable workspace, with some worry about affordability holding over time.',
        'Affordable housing levels (25% on Plot B) are widely felt to be too low for public dock land.',
        'Cumulative infrastructure — transport, healthcare and school places — is the strongest cross-programme theme.',
      ],
      recommendations: [
        'Publish a programme-wide transport, school-places and healthcare capacity plan spanning all three plots.',
        'Revisit the massing and daylight impact of the tallest blocks on Plot B and consider stepping heights down towards existing homes.',
        'Commit in writing to delivering the Plot C park and school early in the phasing.',
        'Set out the affordable housing tenure split and consider increasing the affordable proportion.',
        'Agree a construction logistics and liaison plan with local traders and around the proposed school.',
      ],
      concernAreas: ['Building height and density on Plot B', 'Parking and DLR capacity', 'Delivery phasing of the park and school', 'Affordable housing levels', 'Construction impact and hours'],
      supportAreas: ['Heritage restoration of the mills (Plot A)', 'New public park and green space (Plot C)', 'Primary school and community facilities (Plot C)', 'Affordable maker workspace (Plot A)', 'Public access to the dock edge'],
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
