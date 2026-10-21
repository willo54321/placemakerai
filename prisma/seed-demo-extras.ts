/**
 * Additive demo data on top of existing projects — never deletes anything,
 * and skips anything already present, so it is safe to rerun.
 *
 * 1. "Untypical demo" (untypical-demo): two map comments awaiting
 *    moderation, one approved resident-drawn area, a construction feedback
 *    survey form, a three-stop site tour, and a team reply plus resident
 *    follow-up on the residents' association formal complaint. All
 *    fictional, like the base seed (seed-untypical.ts).
 * 2. "Sunnica Energy Farm" (matched by name, if it exists): eight
 *    illustrative, anonymous public comments on the parcels of the Sunnica
 *    East parameter plan. Sunnica is a real scheme — keep that project's
 *    embed disabled so these are never shown publicly as genuine feedback.
 *
 * Run with:  npx tsx prisma/seed-demo-extras.ts
 * Prod:      set -a && . ./.env.prod && set +a && npx tsx prisma/seed-demo-extras.ts
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import proj4 from 'proj4'

const prisma = new PrismaClient()
const UNTYPICAL = 'untypical-demo'
const now = Date.now()
const hoursAgo = (h: number) => new Date(now - h * 3600_000)
const daysAgo = (d: number) => hoursAgo(d * 24)

async function untypicalExtras() {
  const project = await prisma.project.findUnique({ where: { id: UNTYPICAL }, select: { id: true } })
  if (!project) {
    console.log('Untypical demo not found — skipped')
    return
  }

  // Map comments: two awaiting moderation, one approved drawn area
  const pins = [
    { shapeType: 'pin', latitude: 52.3031, longitude: -0.6636, category: 'question', approved: false, votes: 0, name: 'Laura Bennett', hours: 3,
      comment: 'Can the Phase 1 play park stay open while the Phase 2 drainage works go in next door?' },
    { shapeType: 'pin', latitude: 52.3058, longitude: -0.6651, category: 'negative', approved: false, votes: 0, name: null, hours: 1,
      comment: 'Floodlights from the site compound shine straight into our back bedrooms after 7pm.' },
    { shapeType: 'polygon', latitude: null, longitude: null, category: 'comment', approved: true, votes: 11, name: 'Orchard Close resident', hours: 30,
      comment: 'Keep this strip along the northern boundary as a green buffer — the hedgerow and the two oaks are the only screen between the site and our gardens.',
      geometry: { type: 'Polygon', coordinates: [[[-0.6678, 52.3050], [-0.6627, 52.3050], [-0.6627, 52.3045], [-0.6678, 52.3045], [-0.6678, 52.3050]]] } },
  ]
  for (const { hours, geometry, ...pin } of pins) {
    const exists = await prisma.publicPin.findFirst({ where: { projectId: UNTYPICAL, comment: pin.comment }, select: { id: true } })
    if (exists) continue
    await prisma.publicPin.create({ data: {
      ...pin, projectId: UNTYPICAL, mode: 'feedback', geometry: geometry ?? undefined,
      gdprConsent: true, gdprConsentDate: hoursAgo(hours), createdAt: hoursAgo(hours),
    } })
  }

  const formName = 'Construction feedback survey — Phase 2'
  if (!(await prisma.feedbackForm.findFirst({ where: { projectId: UNTYPICAL, name: formName } }))) {
    await prisma.feedbackForm.create({ data: { projectId: UNTYPICAL, name: formName, active: true, fields: [
      { id: 1, type: 'radio', label: 'How has construction affected you in the last month?', required: true, options: ['Not at all', 'A little', 'Moderately', 'Significantly'] },
      { id: 2, type: 'checkbox', label: 'Which issues have you noticed?', required: false, options: ['Working hours or noise', 'HGVs and deliveries', 'Mud and dust', 'Contractor parking', 'Other'] },
      { id: 3, type: 'rating', label: 'How well is the site team responding to concerns?', required: true, options: [] },
      { id: 4, type: 'textarea', label: 'What one change would make the biggest difference?', required: false, options: [] },
      { id: 5, type: 'email', label: 'Email (optional — for project updates)', required: false, options: [] },
    ] } })
  }

  const tourName = 'Walk the Phase 2 site'
  if (!(await prisma.tour.findFirst({ where: { projectId: UNTYPICAL, name: tourName } }))) {
    await prisma.tour.create({ data: { projectId: UNTYPICAL, name: tourName, active: true,
      description: 'What is changing at the three places residents raised most.',
      stops: { create: [
        { order: 0, title: 'Milton Road site entrance', latitude: 52.3008, longitude: -0.669, zoom: 17,
          description: 'All construction traffic uses this entrance. The wheel wash has moved to the site exit, and a road sweeper now cleans this stretch of Milton Road twice a day.' },
        { order: 1, title: 'Orchard Close boundary', latitude: 52.3056, longitude: -0.664, zoom: 17,
          description: 'Homes on Orchard Close back directly onto the works. Piling does not start before 8am, and the first rig start is checked and logged every morning.' },
        { order: 2, title: 'St Luke’s school corner', latitude: 52.3002, longitude: -0.6612, zoom: 17,
          description: 'Deliveries are held outside 8–9am and 3–4pm on school days, with a banksman on this corner at those times.' },
      ] } } })
  }

  // Reply chain on the residents' association complaint. Stored, never sent.
  const complaint = await prisma.enquiry.findFirst({
    where: { projectId: UNTYPICAL, subject: { startsWith: 'Formal complaint: sustained construction disruption' } },
    include: { messages: { select: { id: true } } },
  })
  if (complaint && complaint.messages.length === 0) {
    await prisma.enquiryMessage.create({ data: {
      enquiryId: complaint.id, direction: 'outbound', deliveryStatus: 'stored', createdAt: hoursAgo(2),
      authorName: 'Alex Morgan', authorEmail: null,
      body: `Dear Peter,

Thank you for pulling this together on behalf of the Residents’ Association — it is the clearest record we have had, and you are right that the site has not been run to the standard we committed to.

From Monday:
• No piling before 8am. The first rig start is now checked and logged each morning.
• A road sweeper on Milton Road twice daily, and the wheel wash moved to the site exit.
• No deliveries 8–9am or 3–4pm on school days, with a banksman on the St Luke’s corner.

Our site manager, Dave McAllister, is your named contact. We would like to meet on site next week — would Tuesday at 10am work?

Kind regards,
Alex Morgan
Community Liaison, Ashfield Park`,
    } })
    await prisma.enquiryMessage.create({ data: {
      enquiryId: complaint.id, direction: 'inbound', deliveryStatus: 'delivered', createdAt: hoursAgo(1),
      authorName: 'Peter Hale', authorEmail: 'peter.hale@example.com',
      body: `Thank you — this is the first reply that actually answers the points we raised.

Tuesday at 10am works. I will bring two residents from Orchard Close and the photos of the damage at number 14.

One thing missing: please confirm in writing how residents can reach Dave out of hours if piling starts early again.

Peter Hale
Chair, Ashfield Residents’ Association`,
    } })
    await prisma.enquiry.update({ where: { id: complaint.id }, data: { status: 'open', read: true } })
  }
  console.log('Untypical demo extras: done')
}

// Sunnica East: positions read off the parameter plan's British National Grid.
const BNG = '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs'
const SUNNICA_COMMENTS: Array<{ at: [number, number]; category: string; votes: number; day: number; comment: string }> = [
  { at: [565830, 273870], category: 'negative', votes: 14, day: 21, comment: 'These fields are some of the best farmland around Freckenham. Why put panels on productive land rather than lower-grade fields?' },
  { at: [565570, 273220], category: 'positive', votes: 6, day: 18, comment: 'Glad to see this set aside for ecology. Grassland here could be great for skylarks if it is actually managed for them.' },
  { at: [568590, 272520], category: 'question', votes: 9, day: 15, comment: 'How tall will the panels be next to the road, and will new hedging screen them from the footpath?' },
  { at: [567420, 273350], category: 'negative', votes: 11, day: 12, comment: 'Construction traffic for the cable route would come straight through the village. Which roads will the lorries use?' },
  { at: [568955, 271390], category: 'question', votes: 17, day: 9, comment: 'The battery storage is close to homes. What is the fire safety plan, and has the fire service been consulted?' },
  { at: [570740, 272640], category: 'comment', votes: 4, day: 7, comment: 'Please keep the permissive path along the northern edge open while the site is being built.' },
  { at: [569985, 272895], category: 'positive', votes: 5, day: 5, comment: 'Supportive overall — better solar here than more gas. Please keep the existing hedgerows and mature trees.' },
  { at: [566450, 274210], category: 'question', votes: 3, day: 2, comment: 'Will the community get any benefit fund, and who decides how it is spent?' },
]

async function sunnicaComments() {
  const projects = await prisma.project.findMany({ where: { name: 'Sunnica Energy Farm' }, select: { id: true } })
  if (projects.length !== 1) {
    console.log(projects.length === 0
      ? 'Sunnica Energy Farm project not found — create it (and import the plan) first, then rerun'
      : 'More than one "Sunnica Energy Farm" project — skipped to avoid guessing')
    return
  }
  const projectId = projects[0].id
  let added = 0
  for (const c of SUNNICA_COMMENTS) {
    if (await prisma.publicPin.findFirst({ where: { projectId, comment: c.comment }, select: { id: true } })) continue
    const [lng, lat] = proj4(BNG, 'WGS84', c.at)
    await prisma.publicPin.create({ data: {
      projectId, mode: 'feedback', shapeType: 'pin', latitude: lat, longitude: lng,
      category: c.category, comment: c.comment, votes: c.votes, approved: true,
      gdprConsent: true, gdprConsentDate: daysAgo(c.day), createdAt: daysAgo(c.day),
    } })
    added++
  }
  console.log(`Sunnica comments: ${added} added`)
}

async function main() {
  await untypicalExtras()
  await sunnicaComments()
}

main()
  .catch(err => { console.error(err); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
