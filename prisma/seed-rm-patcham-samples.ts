/**
 * SAMPLE DATA for the Royal Mail Patcham project (see seed-rm-patcham.ts for
 * the project itself and its real representatives).
 *
 * Adds fictitious construction-issue reports and enquiries so the Construction
 * Issues tab, enquiry inbox and AI analysis have something to show. Every
 * sample person is invented and every email address is on example.com — that
 * domain is the marker this script uses to find and remove its own rows on
 * rerun, so real resident reports and enquiries are never touched. Streets are
 * real Patcham streets around the Patcham Court Farm site; the people and
 * events are not.
 *
 * Run locally:    npx tsx prisma/seed-rm-patcham-samples.ts
 * Run on prod:    npm run seed:rmpatcham:samples:prod   (user runs it)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROJECT_ID = 'cmmkjinxt0000hsj72ivalz84'
const SAMPLE_DOMAIN = '@example.com'

// Days-ago helper with a fixed clock time
function d(daysAgo: number, hour = 12, minute = 0): Date {
  const t = new Date()
  t.setDate(t.getDate() - daysAgo)
  t.setHours(hour, minute, 0, 0)
  return t
}

// Streets around the site (approximate centroids)
const VALE_AVE_W = { lat: 50.8674, lng: -0.1525 } // Vale Avenue, west of the site entrance
const VALE_AVE_E = { lat: 50.8676, lng: -0.1488 } // Vale Avenue towards London Road
const SITE_GATE = { lat: 50.8672, lng: -0.1508 } // site entrance on Vale Avenue
const A23_JUNCTION = { lat: 50.8681, lng: -0.1472 } // Vale Avenue / London Road
const LADIES_MILE = { lat: 50.8641, lng: -0.1492 }
const WINFIELD = { lat: 50.8656, lng: -0.1536 }
const MACKIE = { lat: 50.8664, lng: -0.1561 }
const OVERHILL = { lat: 50.8691, lng: -0.1562 }
const BRAESIDE = { lat: 50.8701, lng: -0.1541 }
const CHURCH_HILL = { lat: 50.8654, lng: -0.1456 }
// Old London Road frontage used for contractor parking (polygon, [lng, lat])
const OLD_LONDON_RD_PARKING = [
  [-0.1478, 50.8648], [-0.1468, 50.8648], [-0.1468, 50.8656], [-0.1478, 50.8656], [-0.1478, 50.8648],
]

type Issue = {
  name: string; email: string; category: string; comment: string
  at: { lat: number; lng: number }; polygon?: number[][]
  day: number; hour?: number
  resolved?: { day: number; notes: string }
}

const ISSUES: Issue[] = [
  {
    name: 'Karen Whitfield', email: 'karen.whitfield@example.com', category: 'noise',
    comment: 'The breaker on the old farm buildings started at 7:15 this morning and again yesterday. We were told work would not begin before 8am. It shakes the whole front of the house.',
    at: VALE_AVE_W, day: 38, hour: 7,
    resolved: { day: 36, notes: 'Contractor confirmed breaker work started early on two days in error. Demolition plant now not started before 08:00; a noise monitor has been placed on the Vale Avenue boundary and readings are reviewed weekly.' },
  },
  {
    name: 'Stephen Mole', email: 'stephen.mole@example.com', category: 'dust',
    comment: 'Since the barns came down there is a film of grey dust on every car on Vale Avenue and we cannot open the front windows. Nothing seems to be being damped down.',
    at: VALE_AVE_W, day: 36, hour: 13,
    resolved: { day: 34, notes: 'Water bowser now damping down during all demolition and crushing; wheel wash operating at the gate. Dust monitors added at the western boundary. Spot checks logged daily by the site manager.' },
  },
  {
    name: 'Jo Fernandes', email: 'jo.fernandes@example.com', category: 'traffic',
    comment: 'Three lorries were queued along Vale Avenue waiting to get into the site this morning, one of them across my driveway for twenty minutes. I could not get out for work.',
    at: VALE_AVE_E, day: 30, hour: 8,
    resolved: { day: 29, notes: 'Holding area created inside the site so deliveries are not called forward until there is space. Hauliers told in writing: no waiting on Vale Avenue. Gate log checked daily.' },
  },
  {
    name: 'Alan Pritchard', email: 'alan.pritchard@example.com', category: 'traffic',
    comment: 'A site lorry came down Ladies Mile Road this afternoon rather than using the A27 route. Residents were told all construction traffic would come off the bypass.',
    at: LADIES_MILE, day: 22, hour: 15,
  },
  {
    name: 'Denise Carr', email: 'denise.carr@example.com', category: 'damage',
    comment: 'Hairline cracks have appeared in the plaster of our landing and above the front door since the piling started. We have photographs from before the works. Please can someone come and inspect.',
    at: WINFIELD, day: 18, hour: 18,
  },
  {
    name: 'Martin Oyelaran', email: 'martin.oyelaran@example.com', category: 'safety',
    comment: 'The pavement outside the site entrance is covered in mud after rain and is genuinely slippery. I use a stick and nearly went over on Tuesday.',
    at: SITE_GATE, day: 15, hour: 9,
    resolved: { day: 14, notes: 'Road sweeper now attending daily at 16:00 and after any wet weather. Footpath jet-washed and a banksman stationed at the gate during deliveries to keep the crossing clear.' },
  },
  {
    name: 'Gillian Ashby', email: 'gillian.ashby@example.com', category: 'hours',
    comment: 'Work was going on until nearly 4pm on Saturday. The permitted hours we were sent say Saturdays finish at 1pm.',
    at: OVERHILL, day: 12, hour: 16,
  },
  {
    name: 'Paul Hennessy', email: 'paul.hennessy@example.com', category: 'noise',
    comment: 'Reversing alarms from about 7:30 every morning carry right up to Braeside Avenue. Could the site use the white-noise type alarms instead of the beepers?',
    at: BRAESIDE, day: 10, hour: 7, 
  },
  {
    name: 'Sunita Rao', email: 'sunita.rao@example.com', category: 'dust',
    comment: 'Washing left out on Mackie Avenue came in covered in dust yesterday afternoon when the wind was from the east. Second time this month.',
    at: MACKIE, day: 9, hour: 17,
  },
  {
    name: 'Robert Kingsley', email: 'robert.kingsley@example.com', category: 'other',
    comment: 'The site floodlights stay on all night and shine straight into our back bedroom. Can they be angled down or put on a timer?',
    at: VALE_AVE_W, day: 7, hour: 22,
  },
  {
    name: 'Fiona Marsh', email: 'fiona.marsh@example.com', category: 'traffic',
    comment: 'Site workers are parking all along Old London Road from 7am and the residents have nowhere to leave their cars. We thought parking was being provided on site.',
    at: { lat: 50.8652, lng: -0.1473 }, polygon: OLD_LONDON_RD_PARKING, day: 5, hour: 8,
  },
  {
    name: 'Nigel Barrow', email: 'nigel.barrow@example.com', category: 'safety',
    comment: 'A hoarding panel near the gate has come loose and was flapping in the wind this evening. It is right next to the footpath.',
    at: SITE_GATE, day: 3, hour: 19,
    resolved: { day: 3, notes: 'Panel re-fixed the same evening by the site team. Full hoarding inspection carried out next morning and added to the weekly checklist.' },
  },
  {
    name: 'Helen Tudor', email: 'helen.tudor@example.com', category: 'noise',
    comment: 'A generator has been running on the site until after 9pm the last two nights. It is a constant drone and can be heard from Church Hill with the windows shut.',
    at: CHURCH_HILL, day: 2, hour: 21,
  },
  {
    name: 'Chris Adeyemi', email: 'chris.adeyemi@example.com', category: 'traffic',
    comment: 'A delivery lorry was parked across the dropped kerb by the site entrance this morning so pushchairs and wheelchairs could not cross Vale Avenue safely.',
    at: SITE_GATE, day: 1, hour: 8,
  },
]

type Enquiry = {
  name: string; email: string; org?: string; phone?: string
  subject: string; message: string; category: string
  status: 'new' | 'open' | 'closed'; read: boolean; day: number; hour: number
}

const ENQUIRIES: Enquiry[] = [
  {
    name: 'Margaret Doyle', email: 'margaret.doyle@example.com', org: 'Patcham Residents’ Association',
    subject: 'Construction traffic management plan — copy and meeting request',
    message: 'On behalf of the Residents’ Association, could we have a copy of the approved construction traffic management plan, including the agreed HGV route and hours? Several members have reported lorries on Ladies Mile Road and Vale Avenue. We would also like to arrange a meeting with the site team before the next phase begins.',
    category: 'general', status: 'open', read: true, day: 28, hour: 10,
  },
  {
    name: 'Tom Reeves', email: 'tom.reeves@example.com',
    subject: 'Permitted working hours on Saturdays',
    message: 'Can you confirm the permitted working hours for the site, in particular on Saturdays? The newsletter said 8am to 1pm but there was activity well into Saturday afternoon last weekend.',
    category: 'planning', status: 'closed', read: true, day: 20, hour: 11,
  },
  {
    name: 'Priya Shah', email: 'priya.shah@example.com',
    subject: 'Dust from the demolition — complaint',
    message: 'I want to make a formal complaint about the dust from the demolition of the farm buildings. My daughter has asthma and we have had to keep her indoors on two afternoons. What dust suppression is actually in place and who is monitoring it?',
    category: 'complaint', status: 'open', read: true, day: 9, hour: 14,
  },
  {
    name: 'Graham Pollard', email: 'graham.pollard@example.com',
    subject: 'Removal of trees along the Vale Avenue boundary',
    message: 'Several mature trees along the Vale Avenue boundary have been felled this week. Were these approved for removal under the planning permission? The plans we saw at the exhibition showed the boundary planting being retained. I object strongly if this was not consented.',
    category: 'objection', status: 'open', read: true, day: 6, hour: 17,
  },
  {
    name: 'Eleanor Finch', email: 'eleanor.finch@example.com', org: 'Patcham Local History Group',
    subject: 'Site visit for the local history group',
    message: 'Good to see the project moving after so many years of uncertainty about the farm site. Our history group would love a short escorted visit before the new building goes up, and we have some photographs of the farm from the 1950s that your team might like for the hoarding or newsletter.',
    category: 'support', status: 'new', read: false, day: 3, hour: 9,
  },
  {
    name: 'Daniel Hart', email: 'daniel.hart@example.com', org: 'Patcham Community News', phone: '07700 900123',
    subject: 'Press enquiry: complaints received since works began',
    message: 'I am writing a piece on the first weeks of construction at Patcham Court Farm. How many complaints has the project received since works began, what were the main themes, and what has Royal Mail changed in response? I would welcome a comment from the project team by Friday.',
    category: 'general', status: 'new', read: false, day: 1, hour: 12,
  },
]

async function main() {
  const project = await prisma.project.findUnique({ where: { id: PROJECT_ID }, select: { name: true } })
  if (!project) {
    throw new Error(`Project ${PROJECT_ID} not found — run prisma/seed-rm-patcham.ts first`)
  }
  console.log(`Seeding sample data into "${project.name}"…`)

  // Remove only this script's earlier rows (example.com marker); real reports stay.
  const removedPins = await prisma.publicPin.deleteMany({
    where: { projectId: PROJECT_ID, mode: 'issues', email: { endsWith: SAMPLE_DOMAIN } },
  })
  const removedEnquiries = await prisma.enquiry.deleteMany({
    where: { projectId: PROJECT_ID, submitterEmail: { endsWith: SAMPLE_DOMAIN } },
  })
  // Cached analysis is stale once the corpus changes; the next run rebuilds it.
  await prisma.analysisResult.deleteMany({ where: { projectId: PROJECT_ID } })
  console.log(`  cleared earlier samples: ${removedPins.count} issue reports, ${removedEnquiries.count} enquiries`)

  for (const issue of ISSUES) {
    await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        mode: 'issues',
        shapeType: issue.polygon ? 'polygon' : 'pin',
        latitude: issue.polygon ? null : issue.at.lat,
        longitude: issue.polygon ? null : issue.at.lng,
        geometry: issue.polygon ? { type: 'Polygon', coordinates: [issue.polygon] } : undefined,
        category: issue.category,
        comment: issue.comment,
        name: issue.name,
        email: issue.email,
        // Issue reports are never public: no publication, no public voting.
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
  }
  const resolvedCount = ISSUES.filter(i => i.resolved).length
  console.log(`  issue reports: ${ISSUES.length} (${resolvedCount} resolved, ${ISSUES.length - resolvedCount} open)`)

  for (const q of ENQUIRIES) {
    await prisma.enquiry.create({
      data: {
        projectId: PROJECT_ID,
        submitterName: q.name,
        submitterEmail: q.email,
        submitterOrg: q.org ?? null,
        submitterPhone: q.phone ?? null,
        subject: q.subject,
        message: q.message,
        category: q.category,
        status: q.status,
        read: q.read,
        channel: 'form',
        gdprConsent: true,
        gdprConsentDate: d(q.day, q.hour, 0),
        createdAt: d(q.day, q.hour, 0),
      },
    })
  }
  console.log(`  enquiries: ${ENQUIRIES.length} (inbound only, no seeded replies)`)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
