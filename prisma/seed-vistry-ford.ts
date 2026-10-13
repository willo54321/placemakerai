/**
 * Seed script for the "Ford Airfield (Vistry Homes)" demo — a construction
 * communications scenario for the Vistry Ford project in Arun, West Sussex.
 *
 * What it shows: the live machinery of a construction comms programme on a
 * large strategic site on the former airfield near Yapton —
 *   - a stakeholder register of the real local civic landscape (parish
 *     councils, ward member, CLT, county PRoW team) with a 3-week engagement
 *     log
 *   - two email conversations in the enquiries messaging client — Maureen
 *     Chaffe (Chair, Ford CLT) and Cllr Amanda Worne (Yapton ward) — each
 *     mirrored into the stakeholder tracker's engagement timeline
 *   - a construction-issue log weighted towards footpaths / public rights of
 *     way: closures, diversions, surface, signage, lighting — mix of open and
 *     resolved-with-notes
 *   - red-line boundary and the temporary footpath diversion route on the map
 *
 * IMPORTANT: every message, report and event here is ILLUSTRATIVE, written
 * for a product demonstration. Named stakeholders hold real public roles but
 * all correspondence is invented and deliberately routine/constructive. All
 * email addresses use the reserved example.org domain so nothing can ever be
 * delivered if someone replies during a live demo.
 *
 * Idempotent: fixed project id, clears the project's children, then rebuilds.
 * Run with:  npx tsx prisma/seed-vistry-ford.ts
 * (Loads .env via dotenv; export DATABASE_URL first to target another db.)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import {
  crossReference,
  CrossRefItem,
  CrossRefAssignment,
} from '../src/lib/cross-reference'

const prisma = new PrismaClient()

const PROJECT_ID = 'vistry-ford'
const CENTRE = { lat: 50.8145, lng: -0.5965 }

// ---------------------------------------------------------------------------
// Pre-computed AI analysis (same approach as seed-untypical): the corpus is
// hand-classified below and the numbers are computed with the product's own
// maths, so the AI Analytics tab is populated instantly with no paid run.
// ---------------------------------------------------------------------------
type Sent = 'positive' | 'negative' | 'neutral'
type Area = 'crossing' | 'diversion' | 'fordlane'

const TAXONOMY = [
  { name: 'Footpath closures & diversions', description: 'The closed Ford–Yapton path, the temporary diversion, notice and signage, waymarking and reopening.', keywords: ['diversion', 'closure', 'reopening', 'signage', 'right of way'] },
  { name: 'Path surface, mud & accessibility', description: 'Mud at crossings and on the highway, loose stone, standing water, and whether routes remain usable for all abilities.', keywords: ['mud', 'surface', 'loose stone', 'standing water', 'mobility'] },
  { name: 'HGV crossings & pedestrian safety', description: 'The Drove Lane haul-route crossing, banksman cover, school-run conflict and vehicles obstructing path access.', keywords: ['HGV', 'banksman', 'crossing', 'school run', 'verge'] },
  { name: 'Site conduct & working hours', description: 'Early starts, generator noise, hoarding condition and plant working near the right of way — how the site is run.', keywords: ['piling', '8am', 'generator', 'hoarding', 'toolbox talk'] },
  { name: 'Dust & air quality', description: 'Dust from stockpiles and site operations reaching paths and properties.', keywords: ['dust', 'stockpile', 'wind', 'sheeting'] },
  { name: 'Lighting & personal safety', description: 'Lighting on the diversion for the school run and darker months, balanced against dark-sky character.', keywords: ['lighting', 'dark', 'school run', 'solar columns', 'dark sky'] },
  { name: 'Scheme design & future provision', description: 'The permanent path network, rights-of-way retention, cycle routes and access improvements the scheme will deliver.', keywords: ['rights of way', 'cycle route', 'kissing gate', 'permanent network'] },
]

// Site conduct/working hours are management matters, not material planning
// considerations; everything else here is material.
const themeIsMaterial = (t: number) => t !== 3
const materialFor = (themes: number[]): 'material' | 'non-material' | 'mixed' => {
  if (themes.length === 0) return 'non-material'
  const mat = themes.some(themeIsMaterial)
  const non = themes.some(t => !themeIsMaterial(t))
  return mat && non ? 'mixed' : mat ? 'material' : 'non-material'
}

// Replicates createFeedbackHash from src/lib/ai.ts exactly, so the stored
// analysis matches the live corpus and is not flagged stale.
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

// Hotspot centres for spatial insights
const CROSSING = { lat: 50.8158, lng: -0.6048 } // Drove Lane haul-route crossing
const DIVERSION = { lat: 50.815, lng: -0.6058 } // temporary diversion, western boundary
const FORDLANE = { lat: 50.812, lng: -0.5872 } // Ford Lane frontage, eastern boundary

function d(daysAgo: number, hour = 12, minute = 0): Date {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date
}

async function main() {
  const projectData = {
    name: 'Ford Airfield (Vistry Homes)',
    description:
      'New homes at Ford Airfield, Arun — on the former airfield near Yapton. Demonstration project for construction communications: all reports and correspondence are illustrative.',
    latitude: CENTRE.lat,
    longitude: CENTRE.lng,
    mapZoom: 15,
    status: 'LIVE' as const,
    embedEnabled: true,
    allowPins: true,
    allowDrawing: true,
    issuesEnabled: true,
    // Demo project: issue reports must never email anyone.
    embedPrimaryColor: '#C8102E',
    embedFontFamily: 'Inter',
    embedDefaultSatellite: true,
  }

  await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: projectData,
    create: { id: PROJECT_ID, ...projectData },
  })

  try {
    await prisma.project.update({ where: { id: PROJECT_ID }, data: { emailLocalPart: 'fordairfield' } })
  } catch {
    console.log('emailLocalPart "fordairfield" unavailable — left unset')
  }

  const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN' } })
  for (const admin of admins) {
    await prisma.projectAccess.upsert({
      where: { userId_projectId: { userId: admin.id, projectId: PROJECT_ID } },
      create: { userId: admin.id, projectId: PROJECT_ID, role: 'ADMIN' },
      update: { role: 'ADMIN' },
    })
  }

  // --- clear children so reruns rebuild cleanly ---------------------------
  await prisma.publicPin.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.geoLayer.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.enquiry.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.stakeholder.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.subscriber.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.campaign.deleteMany({ where: { projectId: PROJECT_ID } })
  await prisma.analysisResult.deleteMany({ where: { projectId: PROJECT_ID } })

  // --- map layers ---------------------------------------------------------
  await prisma.geoLayer.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Ford Airfield red line',
      // 'plot' = served to the public embed as a zone; 'boundary' stays admin-side.
      type: 'plot',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Ford Airfield red line', status: 'Under construction', blurb: 'Ford Airfield site — phase one groundworks and drainage underway.' },
            geometry: {
              type: 'Polygon',
              coordinates: [[
                [-0.6065, 50.8185], [-0.5895, 50.8198], [-0.5862, 50.8092],
                [-0.6042, 50.8083], [-0.6065, 50.8185],
              ]],
            },
          },
        ],
      },
      style: { fillColor: '#C8102E', color: '#C8102E', weight: 2, fillOpacity: 0.05 },
    },
  })
  await prisma.geoLayer.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Temporary footpath diversion (western boundary)',
      type: 'boundary',
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { name: 'Temporary footpath diversion' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-0.6052, 50.8190], [-0.6068, 50.8156], [-0.6058, 50.8118], [-0.6020, 50.8090],
              ],
            },
          },
        ],
      },
      style: { color: '#1D4ED8', weight: 3, dashArray: '6 6' },
    },
  })

  // Corpus collected as rows are created, for the pre-computed analysis.
  type CorpusRow = { id: string; content: string; source: 'pin' | 'enquiry'; latitude: number | null; longitude: number | null; createdAt: Date; sentiment: Sent; themes: number[]; area: Area | null }
  const corpus: CorpusRow[] = []

  // --- stakeholder register ------------------------------------------------
  // Named individuals hold real public roles; contact details are illustrative
  // (example.org can never receive mail). Engagement content is invented.
  type Eng = { type: string; title: string; day: number; hour?: number; minute?: number; description?: string; outcome?: string; nextAction?: string }
  type S = {
    name: string; role?: string; organization?: string; email?: string; phone?: string
    type: string; category: string; influence: number; interest: number; notes?: string
    at?: { lat: number; lng: number }; engagements: Eng[]
  }

  const STAKEHOLDERS: S[] = [
    {
      name: 'Maureen Chaffe',
      role: 'Chair',
      organization: 'Ford Community Land Trust',
      email: 'maureen.chaffe@example.org',
      type: 'community',
      category: 'neutral',
      influence: 4,
      interest: 5,
      notes:
        'Leads the CLT. Constructive and well-connected; priorities are the footpath network between the villages, delivery of the community facilities, and honest timelines. Prefers email, replies quickly. Edits the CLT newsletter (monthly, ~400 households).',
      at: { lat: 50.8190, lng: -0.5800 },
      engagements: [
        { type: 'meeting', title: 'Introductory briefing at CLT coffee morning', day: 18, hour: 10, minute: 30, description: 'Presented the first-year construction programme to ~25 CLT members: phasing, haul routes, and the temporary footpath diversion on the western boundary.', outcome: 'Warm but firm: the footpath network is the thing this community will judge us on. Agreed to share diversion mapping.', nextAction: 'Send diversion plan and reopening dates' },
        { type: 'email', title: 'Footpath diversion mapping sent', day: 16, hour: 14, description: 'Sent the diversion route plan, the six-week closure estimate for the drainage corridor works, and the interim maintenance commitment.' },
        { type: 'email', title: 'Diversion overrun — reopening date (enquiry thread)', day: 9, hour: 9, minute: 15, description: 'Maureen chased the Ford–Yapton path reopening (signed six weeks, now week nine). Full exchange in the enquiries inbox. Committed to a reopening date, weekly surface checks and temporary lighting.', outcome: 'Accepted the revised date; asked for newsletter copy.', nextAction: 'Deliver reopening on the committed date — reputational' },
        { type: 'email', title: 'CLT newsletter copy supplied', day: 6, hour: 16, minute: 30, description: 'Supplied 150 words + diversion map for the CLT newsletter, including the lighting commitment and the liaison group invitation.' },
        { type: 'meeting', title: 'Site walk — diversion route', day: 3, hour: 8, minute: 30, description: 'Walked the diversion with Maureen and two CLT members ahead of the school term: surface, waymarking, lighting columns, the pinch point at the Drove Lane crossing.', outcome: 'Surface and signage acceptable; lighting columns in place. Pinch point needs a banksman at school times (already actioned via issue log).', nextAction: 'Invite CLT to monthly community liaison group — standing seat' },
      ],
    },
    {
      name: 'Cllr Amanda Worne',
      role: 'District Councillor, Yapton ward',
      organization: 'Arun District Council',
      email: 'amanda.worne@example.org',
      type: 'authority',
      category: 'neutral',
      influence: 4,
      interest: 5,
      notes:
        'Ward member for Yapton; first point of contact for resident complaints west of the site. Wants material she can forward to residents verbatim — write everything shareable. Sits on the planning committee; keep scrupulously to the monitoring conditions.',
      engagements: [
        { type: 'call', title: 'Introductory call', day: 12, hour: 11, description: 'Introduced the community team, the issue-reporting channel and the commitment to a 48-hour response on ward-member queries.', outcome: 'Appreciated the direct line. Flagged mud on the Drove Lane footpath crossing as already arriving in her inbox.' },
        { type: 'email', title: 'Resident reports — mud and signage (enquiry thread)', day: 4, hour: 8, minute: 45, description: 'Cllr Worne passed on constituent reports: mud across the footpath at the HGV crossing and missing diversion signage at the northern end. Full exchange in the enquiries inbox.', outcome: 'Mitigation set out and accepted; briefing note requested for parish council meeting.', nextAction: 'Briefing note before Yapton PC meeting' },
        { type: 'email', title: 'Briefing note for Yapton Parish Council', day: 2, hour: 15, description: 'Sent the footpaths briefing note: sweeper frequency, wheel-wash relocation, fixed-post signage, Saturday hours position, and the issue-log summary (reported vs resolved).', outcome: 'Forwarded to the parish clerk for the agenda pack.' },
      ],
    },
    {
      name: 'Ford Parish Council',
      role: 'Parish Council (via the Clerk)',
      organization: 'Ford Parish Council',
      email: 'clerk.fordpc@example.org',
      type: 'authority',
      category: 'neutral',
      influence: 3,
      interest: 5,
      notes: 'Monthly meetings; standing agenda item on the development. Expect formal minuted positions — respond in writing.',
      engagements: [
        { type: 'meeting', title: 'Attended parish council meeting', day: 15, hour: 19, minute: 30, description: 'Standing item: presented the month-one construction report — programme, deliveries, footpath diversion, complaints summary.', outcome: 'Minuted request: advance written notice of any further PRoW closures, and a named site contact.', nextAction: 'Provide named contact card and closure-notice protocol' },
        { type: 'email', title: 'Closure-notice protocol agreed', day: 11, hour: 10, description: 'Agreed protocol: ten working days written notice to both parish councils before any footpath closure or diversion change, with mapping.' },
      ],
    },
    {
      name: 'Yapton Parish Council',
      role: 'Parish Council (via the Clerk)',
      organization: 'Yapton Parish Council',
      email: 'clerk.yaptonpc@example.org',
      type: 'authority',
      category: 'neutral',
      influence: 3,
      interest: 4,
      notes: 'Western approach to the site sits in this parish — HGV routing and the school-run footpath are the live concerns.',
      engagements: [
        { type: 'email', title: 'HGV routing plan shared', day: 13, hour: 9, minute: 30, description: 'Shared the construction traffic management plan: no HGV movements through Yapton village centre, A2024 route only, school-hours restrictions at the Drove Lane crossing.' },
      ],
    },
    {
      name: 'Climping Parish Council',
      role: 'Parish Council (via the Clerk)',
      organization: 'Climping Parish Council',
      email: 'clerk.climpingpc@example.org',
      type: 'authority',
      category: 'undecided',
      influence: 2,
      interest: 3,
      notes: 'Southern neighbour; watching drainage and the coastal-path connections rather than day-to-day construction.',
      engagements: [
        { type: 'email', title: 'Introduction and reporting channel', day: 14, hour: 12, description: 'Introduced the community team and the public issue-reporting map; offered a standing slot at their meetings when agenda-relevant.' },
      ],
    },
    {
      name: 'WSCC Public Rights of Way team',
      role: 'PRoW officer (footpath diversion orders)',
      organization: 'West Sussex County Council',
      email: 'prow.team@example.org',
      type: 'authority',
      category: 'neutral',
      influence: 5,
      interest: 4,
      notes: 'Statutory authority for the footpath network. Formal relationship: diversion orders, signage standards, reinstatement sign-off. Keep an auditable record of every PRoW commitment.',
      engagements: [
        { type: 'meeting', title: 'Diversion order site meeting', day: 17, hour: 14, description: 'Walked the western boundary diversion with the PRoW officer: route, surface spec, waymarking, and the reinstatement standard for the drainage corridor section.', outcome: 'Temporary diversion approved subject to fixed-post signage at both ends and monthly condition reports.', nextAction: 'Monthly PRoW condition report — standing commitment' },
        { type: 'email', title: 'Month-one PRoW condition report', day: 2, hour: 11, description: 'Submitted the first monthly condition report: diversion surface, signage audit, the waymarker replacement, and the reopening programme for the Ford–Yapton path.' },
      ],
    },
    {
      name: 'Arun District Council — planning monitoring',
      role: 'Compliance & monitoring officer',
      organization: 'Arun District Council',
      email: 'planning.monitoring@example.org',
      type: 'authority',
      category: 'neutral',
      influence: 4,
      interest: 3,
      notes: 'Monitors CEMP compliance — hours, dust, wheel-wash. Copy on anything that touches a planning condition.',
      engagements: [
        { type: 'email', title: 'CEMP hours clarification', day: 8, hour: 16, description: 'Confirmed in writing the consented working hours and the position on Saturday working following the ward member query; no Sunday or bank-holiday working.' },
      ],
    },
    {
      name: 'Yapton CE Primary School',
      role: 'School office / head',
      organization: 'Yapton CE Primary School',
      email: 'office.yaptonprimary@example.org',
      type: 'community',
      category: 'neutral',
      influence: 2,
      interest: 4,
      notes: 'Families use the Ford–Yapton footpath on the school run. Term dates drive the lighting and banksman commitments.',
      engagements: [
        { type: 'call', title: 'School-run arrangements for term start', day: 7, hour: 9, description: 'Agreed banksman cover at the Drove Lane crossing 8–9am and 3–4pm on school days, and confirmed the diversion lighting would be live before the clocks change.', outcome: 'School newsletter carried the diversion map.' },
      ],
    },
    {
      name: 'Ford Lane Residents Group',
      role: 'Informal residents group (c. 30 households)',
      organization: 'Ford Lane Residents Group',
      email: 'fordlaneresidents@example.org',
      type: 'community',
      category: 'opposed',
      influence: 2,
      interest: 5,
      notes: 'Closest frontage to the eastern boundary; opposed the allocation at examination. Relations civil but sceptical — every commitment must be dated and kept.',
      at: { lat: 50.8120, lng: -0.5868 },
      engagements: [
        { type: 'meeting', title: 'Doorstep round — eastern boundary', day: 10, hour: 17, minute: 30, description: 'Door-knocked the Ford Lane frontage ahead of the piling programme: dates, hours, and the pre-condition survey offer for the ten closest properties.', outcome: 'Four households booked condition surveys. Main ask: keep the generator noise down at the Church Lane corner (in the issue log).', nextAction: 'Close out the generator issue and report back' },
      ],
    },
    {
      name: 'Arun Ramblers',
      role: 'Local footpaths group',
      organization: 'Arun Ramblers',
      email: 'arunramblers@example.org',
      type: 'community',
      category: 'undecided',
      influence: 2,
      interest: 4,
      notes: 'Walk the parish footpath network weekly; quick to report diversion problems and quick to acknowledge fixes. Useful early-warning channel.',
      engagements: [
        { type: 'email', title: 'Diversion map shared for walk programme', day: 12, hour: 13, description: 'Shared the diversion mapping so the group could re-route their published walks; invited them to report path issues through the public map.' },
      ],
    },
  ]

  let engagementCount = 0
  for (const s of STAKEHOLDERS) {
    const stakeholder = await prisma.stakeholder.create({
      data: {
        projectId: PROJECT_ID,
        name: s.name,
        role: s.role ?? null,
        organization: s.organization ?? null,
        email: s.email ?? null,
        phone: s.phone ?? null,
        type: s.type,
        category: s.category,
        influence: s.influence,
        interest: s.interest,
        notes: s.notes ?? null,
        latitude: s.at?.lat ?? null,
        longitude: s.at?.lng ?? null,
      },
    })
    for (const e of s.engagements) {
      await prisma.stakeholderEngagement.create({
        data: {
          stakeholderId: stakeholder.id,
          type: e.type,
          title: e.title,
          description: e.description ?? null,
          date: d(e.day, e.hour ?? 12, e.minute ?? 0),
          outcome: e.outcome ?? null,
          nextAction: e.nextAction ?? null,
        },
      })
      engagementCount++
    }
  }

  // --- email conversations (enquiries messaging client) --------------------
  // First inbound message lives on the Enquiry itself; the rest of the
  // conversation is EnquiryMessage rows. channel 'email' = arrived by mail.
  type Msg = { dir: 'inbound' | 'outbound'; day: number; hour: number; minute?: number; body: string }
  type Thread = {
    name: string; email: string; org?: string; subject: string; category: string
    status: string; day: number; hour: number; message: string; messages: Msg[]
  }

  const THREADS: Thread[] = [
    {
      name: 'Maureen Chaffe',
      email: 'maureen.chaffe@example.org',
      org: 'Ford Community Land Trust',
      subject: 'Ford–Yapton footpath diversion — reopening date?',
      category: 'construction',
      status: 'open',
      day: 9,
      hour: 9,
      message:
        'Good morning,\n\nAt the CLT coffee morning yesterday several members raised the closed section of the Ford–Yapton footpath along your western boundary. The notice at the stile says six weeks, but we are now in week nine, and the diversion adds the best part of a mile for anyone coming from the Church Lane end. Two of our older members have simply stopped walking it, which is exactly what we said at the briefing we didn’t want to happen.\n\nCould you let me know the actual reopening date, and whether anything can be done about the loose surface on the middle stretch of the diversion in the meantime? Happy to walk it with your team if that’s useful.\n\nBest wishes,\nMaureen Chaffe\nChair, Ford Community Land Trust',
      messages: [
        {
          dir: 'outbound', day: 9, hour: 11, minute: 40,
          body:
            'Dear Maureen,\n\nThank you for raising this, and please pass on our apologies to your members — the notice should have been updated when the programme changed and it wasn’t. That’s been corrected today.\n\nThe honest position: the drainage corridor that runs under that section held water badly after the wet fortnight, and the reinstatement couldn’t be built on it safely. The revised reopening date is three weeks today, and we are confident in it — the drainage run is complete and the path build-up starts Monday. We’ve also asked the contractor to regrade and re-stone the loose middle stretch of the diversion this week, with a walked check every Friday until the main path reopens.\n\nWe’d very much take you up on the site walk — would 8:30 on a morning that suits work for you and any members who’d like to come?\n\nKind regards,\nFord Community Team\nVistry Homes',
        },
        {
          dir: 'inbound', day: 7, hour: 8, minute: 55,
          body:
            'Thank you — that’s a straight answer and the corrected notice has been spotted already.\n\nTwo follow-ups. First, the mornings are drawing in: is there any lighting planned on the diversion for the school run, particularly the stretch behind the old perimeter track? Second, our newsletter goes to print Friday — if you can give me 150 words on the reopening date and what’s being done in the meantime, I’ll run it as you write it.\n\nMaureen',
        },
        {
          dir: 'outbound', day: 6, hour: 16, minute: 20,
          body:
            'Dear Maureen,\n\nOn lighting: yes — four temporary solar columns are agreed with the contractor for the perimeter-track stretch, to be installed by the end of next week, and we’ve committed to them staying until the main path reopens.\n\nNewsletter copy is attached as requested — 148 words, plus the diversion map in print resolution. It includes the reopening date, so we’re now publicly committed to it, which is as it should be.\n\nLastly — we run a monthly community liaison group for the construction programme and would like the CLT to hold a standing seat. First meeting of the autumn is on the 14th. Would you join us?\n\nKind regards,\nFord Community Team',
        },
        {
          dir: 'inbound', day: 5, hour: 13, minute: 5,
          body:
            'Copy received and gone to the printers unchanged — thank you for making it easy.\n\nYes to the liaison group on the 14th; I’ll bring our footpaths lead. And thank you for the lighting commitment — that’s the one I’d have been chased on all autumn.\n\nMaureen',
        },
      ],
    },
    {
      name: 'Cllr Amanda Worne',
      email: 'amanda.worne@example.org',
      org: 'Arun District Council (Yapton ward)',
      subject: 'Resident reports — mud and missing signage, Drove Lane footpath crossing',
      category: 'construction',
      status: 'open',
      day: 4,
      hour: 8,
      message:
        'Good morning,\n\nI’ve had five separate reports from Yapton residents this week about the footpath where your haul route crosses at Drove Lane: mud carried across the crossing making it genuinely slippery, and the diversion sign at the northern end is down again, so people are finding the closure by walking into it.\n\nI’d like to understand what mitigation is in place at that crossing, and when the signage will be fixed properly rather than re-taped. If you can give me something in writing I can share with residents directly, that is always my preference.\n\nRegards,\nAmanda Worne\nDistrict Councillor, Yapton ward',
      messages: [
        {
          dir: 'outbound', day: 4, hour: 12, minute: 10,
          body:
            'Dear Cllr Worne,\n\nThank you for passing these on — and the reports are fair. What’s been done, with dates:\n\n• Road sweeper now covers the Drove Lane crossing twice daily (7:30am and 4pm) rather than once, starting this morning.\n• The wheel wash has been moved to the compound exit so vehicles cross the footpath clean — completed yesterday after your office’s first call.\n• The northern diversion sign is being replaced on Thursday with a fixed post set in concrete at each end of the closure, replacing the temporary frames that keep being knocked over.\n• A banksman is posted at the crossing 8–9am and 3–4pm on school days.\n\nEverything above is written to be shared with residents verbatim, and the crossing is on the site manager’s daily walk with photographs logged. If reports continue after Thursday, I’d be grateful to hear directly.\n\nKind regards,\nFord Community Team\nVistry Homes',
        },
        {
          dir: 'inbound', day: 3, hour: 17, minute: 45,
          body:
            'Thank you — I’ve forwarded that to the residents who contacted me and the tone was right.\n\nTwo things before Yapton Parish Council meets on Monday: could I have a short briefing note covering the footpath position overall (not just the crossing), and can you confirm the position on Saturday working? There’s a belief locally that weekend hours have been extended.\n\nAmanda Worne',
        },
        {
          dir: 'outbound', day: 2, hour: 15, minute: 30,
          body:
            'Dear Cllr Worne,\n\nBriefing note sent alongside this message — it covers the diversion programme and reopening date, the signage and surface works, the sweeper and wheel-wash arrangements, and a summary from our issue log (11 footpath-related reports received, 7 resolved with notes, 4 in progress with owners and dates).\n\nOn Saturday working: hours are unchanged and as consented — 8am to 1pm, no Sunday or bank holiday working. We’ve had no variation and none is sought. That confirmation is in the note in writing, and we’ve copied the district monitoring officer so the parish can verify it independently.\n\nKind regards,\nFord Community Team',
        },
      ],
    },
  ]

  // Hand classification, same order as THREADS.
  const ENQ_CLS: Array<{ s: Sent; t: number[] }> = [
    { s: 'negative', t: [0, 1, 5] }, // Maureen — closure overrun, surface, lighting
    { s: 'negative', t: [1, 2, 0] }, // Cllr Worne — mud, crossing safety, signage
  ]

  let messageCount = 0
  for (const t of THREADS) {
    const enquiry = await prisma.enquiry.create({
      data: {
        projectId: PROJECT_ID,
        submitterName: t.name,
        submitterEmail: t.email,
        submitterOrg: t.org ?? null,
        subject: t.subject,
        message: t.message,
        category: t.category,
        status: t.status,
        read: true,
        channel: 'email',
        gdprConsent: true,
        gdprConsentDate: d(t.day, t.hour, 0),
        createdAt: d(t.day, t.hour, 0),
      },
    })
    const eCls = ENQ_CLS[THREADS.indexOf(t)]
    corpus.push({
      id: enquiry.id, content: `${t.subject}: ${t.message}`, source: 'enquiry',
      latitude: null, longitude: null, createdAt: d(t.day, t.hour, 0),
      sentiment: eCls.s, themes: eCls.t, area: null,
    })
    for (const m of t.messages) {
      await prisma.enquiryMessage.create({
        data: {
          enquiryId: enquiry.id,
          direction: m.dir,
          body: m.body,
          authorName: m.dir === 'inbound' ? t.name : 'Ford Community Team',
          authorEmail: m.dir === 'inbound' ? t.email : null,
          deliveryStatus: m.dir === 'inbound' ? 'delivered' : 'sent',
          createdAt: d(m.day, m.hour, m.minute ?? 0),
        },
      })
      messageCount++
    }
  }

  // --- construction issues (footpath-heavy) --------------------------------
  type Issue = {
    category: string; comment: string; name: string; email: string
    at: { lat: number; lng: number }; day: number; hour?: number
    resolved?: { day: number; notes: string }
  }

  const ISSUES: Issue[] = [
    {
      category: 'safety',
      comment: 'The footpath along your western boundary is blocked with Heras fencing and there was no diversion sign at the northern end this morning — I only found out it was shut after walking ten minutes up to the fence with a pushchair and having to turn round.',
      name: 'Sarah Mitchell', email: 'sarah.mitchell@example.org',
      at: { lat: 50.8194, lng: -0.5990 }, day: 20, hour: 8,
      resolved: { day: 14, notes: 'Temporary sign frames replaced with fixed posts set in concrete at both ends of the closure, with the diversion map on each. Signage added to the site manager’s daily walk checklist with photo log.' },
    },
    {
      category: 'safety',
      comment: 'Where the lorries cross the footpath at Drove Lane the surface is covered in wet clay. My mother slipped there on Tuesday — she caught the rail, but someone will go over properly before long.',
      name: 'Paul Hendry', email: 'paul.hendry@example.org',
      at: { lat: 50.8158, lng: -0.6048 }, day: 16, hour: 9,
      resolved: { day: 12, notes: 'Wheel wash relocated to the compound exit so vehicles cross clean; sweeper now covers the crossing twice daily (7:30am and 4pm); crossing boards scrubbed and re-gritted. Crossing inspected daily with photographs.' },
    },
    {
      category: 'safety',
      comment: 'The diverted path behind the old perimeter track is pitch dark by 7pm. Children use this for the school run and it will only get darker — is any lighting planned before the clocks change?',
      name: 'Nicola Price', email: 'nicola.price@example.org',
      at: { lat: 50.8165, lng: -0.6055 }, day: 13, hour: 19,
      resolved: { day: 4, notes: 'Four temporary solar lighting columns installed along the perimeter-track stretch, agreed to remain until the main path reopens. Checked on the Friday diversion walk.' },
    },
    {
      category: 'other',
      comment: 'You’ve taken out the stile at the Church Lane end and strung orange netting across the gap. Either it’s a right of way or it isn’t — at the moment people are climbing through the netting.',
      name: 'Derek Hoad', email: 'derek.hoad@example.org',
      at: { lat: 50.8118, lng: -0.5878 }, day: 15, hour: 14,
      resolved: { day: 9, notes: 'Stile replaced with a kissing gate (agreed with the WSCC PRoW officer as the permanent arrangement — better accessibility than the old stile). Netting removed.' },
    },
    {
      category: 'traffic',
      comment: 'Lorries are reversing over the footpath crossing without anyone guiding them. There is supposed to be a banksman — this morning at 8:20 there wasn’t, and that’s exactly school-run time.',
      name: 'Joanne Baxter', email: 'joanne.baxter@example.org',
      at: { lat: 50.8159, lng: -0.6046 }, day: 11, hour: 8,
      resolved: { day: 8, notes: 'Banksman cover made a standing rota item for 8–9am and 3–4pm on school days, confirmed with the groundworks contractor in writing. Gate log records cover at each shift; two spot checks since with no gaps.' },
    },
    {
      category: 'other',
      comment: 'The diversion route is fine if you can walk a mile further, but I use a mobility scooter and the loose stone on the middle section stops me completely. The closed path was the only level route between the villages.',
      name: 'Margaret Ellison', email: 'margaret.ellison@example.org',
      at: { lat: 50.8140, lng: -0.6063 }, day: 12, hour: 11,
    },
    {
      category: 'safety',
      comment: 'There’s a gap in the hoarding where it meets the footpath near the perimeter track and dog walkers are cutting through the site at weekends. Someone is going to end up in an open excavation.',
      name: 'Tom Garrett', email: 'tom.garrett@example.org',
      at: { lat: 50.8178, lng: -0.6040 }, day: 10, hour: 16,
      resolved: { day: 6, notes: 'Hoarding panel refixed and the join detail strengthened. Perimeter now walked weekly (Friday) with the check logged; no further breaches found on the last two walks.' },
    },
    {
      category: 'dust',
      comment: 'On dry windy days the dust off the big soil heap blows straight across the diverted footpath. You can taste it. Can the heap be covered or watered when it’s windy?',
      name: 'Rachel Okafor', email: 'rachel.okafor@example.org',
      at: { lat: 50.8146, lng: -0.5960 }, day: 8, hour: 15,
    },
    {
      category: 'hours',
      comment: 'Piling started before 7:30 this morning — I checked my phone. The consent says 8am. This is the second time this week.',
      name: 'Alan Whitcombe', email: 'alan.whitcombe@example.org',
      at: { lat: 50.8120, lng: -0.5872 }, day: 9, hour: 7,
      resolved: { day: 7, notes: 'Piling contractor reminded in writing of the 8am consented start; rig start time now logged daily by the site manager. District monitoring officer copied on the correction. No repeat since.' },
    },
    {
      category: 'traffic',
      comment: 'Mud all over Ford Road by your site exit again after yesterday’s rain. Cars are tracking it half a mile towards the station.',
      name: 'Keith Dunning', email: 'keith.dunning@example.org',
      at: { lat: 50.8095, lng: -0.5890 }, day: 7, hour: 8,
      resolved: { day: 5, notes: 'Sweeper route extended to cover the Ford Road stretch to the junction, running after each haul window. Exit apron re-stoned and the wheel wash pressure checked.' },
    },
    {
      category: 'damage',
      comment: 'One of your diggers has flattened the footpath waymarker post where the path turns at the old runway. Without it, nobody new to the area has any idea where the right of way goes.',
      name: 'Arun Ramblers (via group email)', email: 'arunramblers@example.org',
      at: { lat: 50.8150, lng: -0.5935 }, day: 6, hour: 13,
      resolved: { day: 3, notes: 'Waymarker replaced on a new post with the PRoW officer’s agreement on position; operator toolbox talk held on working near the right of way.' },
    },
    {
      category: 'other',
      comment: 'After the weekend rain there’s standing water right across the diversion at the low point — twenty feet of it, ankle deep. People are walking the field edge instead, which the farmer won’t thank you for.',
      name: 'Gillian Mortlock', email: 'gillian.mortlock@example.org',
      at: { lat: 50.8105, lng: -0.6005 }, day: 3, hour: 10,
    },
    {
      category: 'noise',
      comment: 'The generator at the Church Lane corner of the site runs into the evening — it’s a constant drone in our back gardens. Does it need to be on that corner at all?',
      name: 'Ford Lane Residents Group', email: 'fordlaneresidents@example.org',
      at: { lat: 50.8116, lng: -0.5875 }, day: 5, hour: 20,
    },
    {
      category: 'traffic',
      comment: 'Delivery lorries waiting for the gate are parking on the verge across the footpath entrance on the Yapton side. This morning two were fully across it and I had to walk in the road.',
      name: 'Hannah Searle', email: 'hannah.searle@example.org',
      at: { lat: 50.8172, lng: -0.6058 }, day: 2, hour: 8,
    },
  ]

  // Hand classification, same order as ISSUES.
  const ISSUE_CLS: Array<{ t: number[]; area: Area | null }> = [
    { t: [0], area: 'diversion' },    // blocked path, no sign at northern end
    { t: [1, 2], area: 'crossing' },  // mud at the Drove Lane crossing
    { t: [5, 0], area: 'diversion' }, // unlit diversion on the school run
    { t: [0], area: 'fordlane' },     // stile removed, netting across the path
    { t: [2], area: 'crossing' },     // no banksman at school time
    { t: [1, 0], area: 'diversion' }, // loose stone stops a mobility scooter
    { t: [3], area: 'diversion' },    // hoarding gap, dog walkers in site
    { t: [4], area: null },           // stockpile dust across the path
    { t: [3], area: 'fordlane' },     // piling before 8am
    { t: [1], area: null },           // mud on Ford Road at the exit
    { t: [0, 3], area: null },        // waymarker flattened by plant
    { t: [1], area: 'diversion' },    // standing water at the low point
    { t: [3], area: 'fordlane' },     // generator noise, Church Lane corner
    { t: [2], area: 'crossing' },     // lorries parked across the path entrance
  ]

  let issueCount = 0
  let resolvedCount = 0
  for (const issue of ISSUES) {
    const createdIssue = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        mode: 'issues',
        shapeType: 'pin',
        latitude: issue.at.lat,
        longitude: issue.at.lng,
        category: issue.category,
        comment: issue.comment,
        name: issue.name,
        email: issue.email,
        votes: 0,
        approved: false,
        resolved: Boolean(issue.resolved),
        resolvedAt: issue.resolved ? d(issue.resolved.day, 17, 0) : null,
        resolvedNotes: issue.resolved?.notes ?? null,
        gdprConsent: true,
        gdprConsentDate: d(issue.day, issue.hour ?? 12, 5),
        createdAt: d(issue.day, issue.hour ?? 12, 5),
      },
    })
    issueCount++
    if (issue.resolved) resolvedCount++
    const iCls = ISSUE_CLS[ISSUES.indexOf(issue)]
    corpus.push({
      id: createdIssue.id, content: issue.comment, source: 'pin',
      latitude: issue.at.lat, longitude: issue.at.lng, createdAt: d(issue.day, issue.hour ?? 12, 5),
      sentiment: 'negative', themes: iCls.t, area: iCls.area,
    })
  }

  // --- a little approved map feedback so the public map isn't bare ---------
  const FEEDBACK = [
    { category: 'question', comment: 'Will the footpath network across the site be kept as public rights of way once the homes are built, or do they become estate paths?', at: { lat: 50.8142, lng: -0.5955 }, day: 14 },
    { category: 'positive', comment: 'Credit where due — the new kissing gate at Church Lane is far easier with a dog than the old stile ever was.', at: { lat: 50.8119, lng: -0.5880 }, day: 8 },
    { category: 'comment', comment: 'Please make sure the permanent path lighting is the dark-sky type. We moved here for the dark skies and the temporary columns are already brighter than they need to be.', at: { lat: 50.8160, lng: -0.6045 }, day: 6 },
    { category: 'question', comment: 'Is there a date yet for the first section of the new cycle route towards the station?', at: { lat: 50.8108, lng: -0.5900 }, day: 4 },
  ]
  // Hand classification, same order as FEEDBACK.
  const FB_CLS: Array<{ s: Sent; t: number[]; area: Area | null }> = [
    { s: 'neutral', t: [6, 0], area: null },        // PRoW retention question
    { s: 'positive', t: [6, 0], area: 'fordlane' }, // kissing gate praise
    { s: 'neutral', t: [5, 6], area: 'diversion' }, // dark-sky lighting ask
    { s: 'neutral', t: [6], area: null },           // cycle route question
  ]
  for (const f of FEEDBACK) {
    const createdFb = await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        mode: 'feedback',
        shapeType: 'pin',
        latitude: f.at.lat,
        longitude: f.at.lng,
        category: f.category,
        comment: f.comment,
        votes: Math.floor(Math.random() * 6),
        approved: true,
        gdprConsent: true,
        gdprConsentDate: d(f.day, 12, 0),
        createdAt: d(f.day, 12, 0),
      },
    })
    const fCls = FB_CLS[FEEDBACK.indexOf(f)]
    corpus.push({
      id: createdFb.id, content: f.comment, source: 'pin',
      latitude: f.at.lat, longitude: f.at.lng, createdAt: d(f.day, 12, 0),
      sentiment: fCls.s, themes: fCls.t, area: fCls.area,
    })
  }

  // ========================================================================
  // Build the AI analysis from the corpus, using the product's own maths.
  // ========================================================================
  const analysis = buildAnalysis(corpus)
  const feedbackHash = createFeedbackHash(corpus.map(c => ({ id: c.id, content: c.content })))
  await prisma.analysisResult.upsert({
    where: { projectId_type: { projectId: PROJECT_ID, type: 'full' } },
    update: { data: analysis as object, status: 'complete', feedbackHash, batchId: null, error: null },
    create: { projectId: PROJECT_ID, type: 'full', data: analysis as object, status: 'complete', feedbackHash },
  })
  console.log(`Stored AI analysis (${corpus.length} items, hash ${feedbackHash})`)

  console.log(`Stakeholders: ${STAKEHOLDERS.length} (engagements: ${engagementCount})`)
  console.log(`Email threads: ${THREADS.length} (messages incl. openers: ${messageCount + THREADS.length})`)
  console.log(`Construction issues: ${issueCount} (${resolvedCount} resolved with notes, ${issueCount - resolvedCount} open)`)
  console.log(`Feedback pins: ${FEEDBACK.length} (approved)`)
  console.log()
  console.log(`Done. Project id: ${PROJECT_ID}`)
  console.log(`Dashboard: /projects/${PROJECT_ID}`)
  console.log(`Issue reporter embed: /embed/${PROJECT_ID}/issues`)

  // ----- inner: assemble a FullAnalysisResult ----------------------------
  function buildAnalysis(rows: CorpusRow[]) {
    const taxonomy = TAXONOMY
    const assignments = rows.map(r => ({
      id: r.id,
      sentiment: r.sentiment,
      confidence: 0.8 + ((r.themes.length * 7) % 15) / 100,
      themeIds: r.themes,
      material: materialFor(r.themes),
      materialCategories: materialFor(r.themes) !== 'non-material' ? r.themes.filter(themeIsMaterial).map(t => taxonomy[t].name) : [],
      nonMaterialCategories: materialFor(r.themes) !== 'material' ? r.themes.filter(t => !themeIsMaterial(t)).map(t => taxonomy[t].name) : [],
    }))

    // Real cross-reference maths — same code the live pipeline uses.
    const crItems: CrossRefItem[] = rows.map(r => ({ id: r.id, type: r.source, latitude: r.latitude, longitude: r.longitude, createdAt: r.createdAt }))
    const crAssign: CrossRefAssignment[] = rows.map(r => ({ id: r.id, sentiment: r.sentiment, themeIds: r.themes }))
    const crossRef = crossReference(crItems, taxonomy.map(t => ({ name: t.name })), crAssign, { areaPrecision: 3, minSegmentSize: 8, minCount: 3 })

    const count = (pred: (r: CorpusRow) => boolean) => rows.filter(pred).length
    const breakdown = { positive: count(r => r.sentiment === 'positive'), negative: count(r => r.sentiment === 'negative'), neutral: count(r => r.sentiment === 'neutral') }
    const bySrc = (src: CorpusRow['source']) => ({ positive: count(r => r.source === src && r.sentiment === 'positive'), negative: count(r => r.source === src && r.sentiment === 'negative'), neutral: count(r => r.source === src && r.sentiment === 'neutral') })
    const total = rows.length
    const sentiment = {
      overall: 'negative' as const,
      score: Math.round(((breakdown.positive - breakdown.negative) / total) * 100) / 100,
      breakdown,
      bySource: { pins: bySrc('pin'), forms: { positive: 0, negative: 0, neutral: 0 }, enquiries: bySrc('enquiry') },
      items: assignments.map(a => ({ id: a.id, sentiment: a.sentiment, confidence: a.confidence })),
    }

    const themes = taxonomy.map((t, i) => {
      const members = rows.filter(r => r.themes.includes(i))
      const sb = { positive: members.filter(m => m.sentiment === 'positive').length, negative: members.filter(m => m.sentiment === 'negative').length, neutral: members.filter(m => m.sentiment === 'neutral').length }
      const dominant: 'positive' | 'negative' | 'neutral' | 'mixed' = sb.positive > 0 && sb.negative > 0 ? 'mixed' : sb.positive >= sb.negative && sb.positive >= sb.neutral ? 'positive' : sb.negative >= sb.neutral ? 'negative' : 'neutral'
      return { name: t.name, count: members.length, sentiment: dominant, keywords: t.keywords, sampleQuotes: members.slice(0, 3).map(m => quote(m.content)), sentimentBreakdown: sb }
    }).filter(t => t.count > 0).sort((a, b) => b.count - a.count)

    // Geographic clusters (~100m grid) from items with coordinates.
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

    // Spatial insights — one per hotspot, from real per-area counts.
    const AREAS: Array<{ key: Area; label: string; centre: { lat: number; lng: number }; headline: string }> = [
      {
        key: 'crossing', label: 'Drove Lane haul-route crossing', centre: CROSSING,
        headline: 'The single point where HGVs and walkers meet generates the safety reports — mud on the crossing, banksman cover at school times and lorries obstructing the path entrance. The sweeper, wheel-wash and banksman regime is the visible test of the response.',
      },
      {
        key: 'diversion', label: 'Temporary diversion (western boundary)', centre: DIVERSION,
        headline: 'The diversion is doing the reputational work of the closed path, and it is where the pressure concentrates: the overrun closure, missing signage at the northern end, loose surface, standing water, lighting for the school run and accessibility for mobility-scooter users.',
      },
      {
        key: 'fordlane', label: 'Ford Lane frontage (eastern boundary)', centre: FORDLANE,
        headline: 'The closest frontage to the works reports site-discipline issues — the early piling start and the generator at the Church Lane corner — alongside the stile-to-kissing-gate access change, which drew the log’s only unprompted praise once resolved.',
      },
    ]
    const spatialInsights = AREAS.map(a => {
      const inArea = rows.filter(r => r.area === a.key)
      const areaTotal = inArea.length || 1
      const themeCounts: Record<number, number> = {}
      inArea.forEach(r => r.themes.forEach(t => { themeCounts[t] = (themeCounts[t] || 0) + 1 }))
      const topTheme = Number(Object.entries(themeCounts).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0)
      const themeCount = themeCounts[topTheme] || 0
      const baselineShare = Math.round((rows.filter(r => r.themes.includes(topTheme)).length / total) * 100) / 100
      const share = Math.round((themeCount / areaTotal) * 100) / 100
      return {
        latitude: a.centre.lat, longitude: a.centre.lng, areaLabel: a.label,
        theme: taxonomy[topTheme].name, headline: a.headline,
        quote: quote(inArea.find(r => r.themes.includes(topTheme))?.content ?? ''),
        count: themeCount, areaTotal, share,
        baselineShare, lift: baselineShare > 0 ? Math.round((share / baselineShare) * 10) / 10 : 0, pValue: 0.01,
        dominantSentiment: 'negative' as const,
        responseIds: inArea.filter(r => r.themes.includes(topTheme)).slice(0, 5).map(r => r.id),
      }
    })

    const materialAnalysis = {
      summary: { material: count(r => materialFor(r.themes) === 'material'), nonMaterial: count(r => materialFor(r.themes) === 'non-material'), mixed: count(r => materialFor(r.themes) === 'mixed') },
      categories: {
        material: [0, 1, 2, 4, 5, 6].map(i => ({ name: taxonomy[i].name, count: rows.filter(r => r.themes.includes(i)).length, examples: rows.filter(r => r.themes.includes(i)).slice(0, 2).map(r => quote(r.content)) })).filter(c => c.count > 0),
        nonMaterial: [3].map(i => ({ name: taxonomy[i].name, count: rows.filter(r => r.themes.includes(i)).length, examples: rows.filter(r => r.themes.includes(i)).slice(0, 2).map(r => quote(r.content)) })).filter(c => c.count > 0),
      },
      items: assignments.map(a => ({ id: a.id, classification: a.material, materialCategories: a.materialCategories, nonMaterialCategories: a.nonMaterialCategories })),
    }

    // Campaign detection: nothing templated — itself a key finding here.
    const campaignAnalysis = {
      totalAnalyzed: total,
      templatedCount: 0,
      uniqueCount: total,
      campaigns: [] as never[],
    }

    const footpath = rows.filter(r => r.themes.some(t => [0, 1, 2, 5].includes(t))).length
    const headlineStats = {
      stats: [
        { text: `${total} items analysed — ${footpath} (${Math.round((footpath / total) * 100)}%) concern the footpath network: closures, surface, crossings and lighting`, type: 'insight' as const },
        { text: 'The temporary diversion carries the most reports of any location — signage, surface, lighting and accessibility', type: 'concern' as const },
        { text: '9 of 14 reported issues already resolved, with dated resolution notes on the record', type: 'support' as const },
        { text: 'Ward-member and CLT correspondence answered same-day, with commitments mirrored to the engagement log', type: 'support' as const },
        { text: 'No organised campaign detected: reports are individual, specific and located', type: 'insight' as const },
      ],
    }

    const summary = {
      executive: `Analysis of ${total} items — issue reports, map feedback and enquiries — shows this development being judged on one thing above all: the footpath network between Ford, Yapton and Climping. ${footpath} of ${total} items concern paths — the overrun Ford–Yapton closure, conditions on the temporary diversion, and the Drove Lane haul-route crossing — and they concentrate at three locations: the diversion itself (signage, loose surface, standing water, lighting, accessibility), the crossing (mud, banksman cover at school times, obstructed access), and the Ford Lane frontage (working-hours and noise discipline). Sentiment is negative but the opposition is practical, not ideological: there is no campaign, scheme-level feedback is balanced — the kissing gate drew unprompted praise and the questions are about retention of rights of way and the promised cycle route — and both the CLT chair and the ward member are engaging constructively through the correspondence channel. The response machinery is visibly working: nine of fourteen issues are resolved with dated notes, and the commitments that matter (the published reopening date, diversion lighting before the clocks change, banksman cover at school times) are on the record. The reputational risk is singular and clear: miss the reopening date and every resolved issue is rendered worthless; hit it and the project has a documented footpath record to stand on for the remaining phases.`,
      keyFindings: [
        'Footpath closures & diversions is the largest theme — the overrun Ford–Yapton closure is the single most reported issue and the source of both stakeholder email threads.',
        'The temporary diversion is the critical location: six separate reports cover its signage, surface, standing water, lighting and accessibility — it is standing in for the closed path and being judged to a permanent-path standard.',
        'The Drove Lane crossing is the highest-urgency safety location — mud, banksman gaps at school times and lorries obstructing the path entrance all describe the same pedestrian/HGV conflict.',
        'Accessibility is a latent escalation risk: the diversion currently excludes mobility-scooter users entirely, the only issue on the log with no workaround.',
        'No templated or coordinated responses detected, and scheme-level feedback is balanced — the credible response is visible footpath delivery, not messaging.',
      ],
      recommendations: [
        'Treat the published reopening date as immovable: the commitment is now in the CLT newsletter and the parish record, and every other resolved issue is judged against it.',
        'Hold the diversion to a permanent-path standard until reopening — weekly walked checks (surface, signage, lighting, drainage at the low point) logged with photographs.',
        'Fix the accessibility gap: agree an interim accessible route or assistance arrangement with WSCC PRoW and write to the affected resident — this is the likeliest formal complaint on the log.',
        'Keep banksman cover at the Drove Lane crossing contractually locked to school terms, and confirm the arrangement in writing each term to the school and both parish councils.',
        'Keep mirroring stakeholder correspondence into the engagement log — the same-day, in-writing pattern with the CLT chair and ward member is the audit trail the final consultation report will rely on.',
      ],
      concernAreas: ['The Ford–Yapton path reopening date', 'Diversion condition (signage, surface, water, lighting)', 'Pedestrian/HGV conflict at the Drove Lane crossing', 'Accessibility of the temporary diversion', 'Working-hours and noise discipline on the Ford Lane frontage'],
      supportAreas: ['The kissing-gate access improvement', 'The documented resolved-issue record (9 of 14, dated)', 'Same-day stakeholder correspondence', 'Retained rights of way in the permanent scheme', 'The promised cycle route to the station'],
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

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
