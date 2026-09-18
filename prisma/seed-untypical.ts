/**
 * Seed script for the "Untypical demo" project — the RFP 8.3.4 crisis scenario.
 *
 * A live development (fictional "Ashfield Park, Phase 2", 240 homes on the
 * eastern edge of Wellingborough) experiencing sustained construction
 * disruption: three complaint hotspots, councillors involved, regional and
 * national press circling. The seed shows the response machinery working:
 *   - ~30 construction-issue reports clustered on the haul road, the northern
 *     residential boundary and the school corner — mix of open, resolved
 *     (with public resolution notes) and pending-moderation
 *   - general map feedback kept separate from the issue log
 *   - red-line boundary + construction-area zone on the map
 *   - stakeholder register (councillors, MP, residents' association, school,
 *     press, highways, contractor) with a 48-hour engagement log
 *   - inbound enquiries only — no seeded replies, so responses can be
 *     composed live in a demo
 *   - consented mailing-list subscribers + a DRAFT "what we're changing this
 *     week" update email, ready to send
 *
 * All names, addresses and events are fictional. No notification emails are
 * configured and nothing outbound is fabricated as sent.
 *
 * Idempotent: fixed project id, clears the project's children, then rebuilds.
 * Run with:  npx tsx prisma/seed-untypical.ts
 * (Loads .env via dotenv; export DATABASE_URL first to target another db.)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PROJECT_ID = 'untypical-demo'

// --- geography (fictional, near Wellingborough) ---------------------------
const CENTRE = { lat: 52.303, lng: -0.665 }
// Hotspots
const ENTRANCE = { lat: 52.3008, lng: -0.669 } // site entrance / Milton Road haul route
const ORCHARD = { lat: 52.3056, lng: -0.664 } // Orchard Close, northern boundary
const SCHOOL = { lat: 52.3002, lng: -0.6612 } // St Luke's Primary corner

// Deterministic jitter so reruns produce the same map
function jitter(base: { lat: number; lng: number }, i: number, spread = 0.0012) {
  const a = Math.sin(i * 127.1) * 0.5
  const b = Math.sin(i * 311.7) * 0.5
  return { lat: base.lat + a * spread, lng: base.lng + b * spread }
}

// Days-ago helper with a fixed clock time
function d(daysAgo: number, hour = 12, minute = 0): Date {
  const t = new Date()
  t.setDate(t.getDate() - daysAgo)
  t.setHours(hour, minute, 0, 0)
  return t
}

const rect = (s: number, w: number, n: number, e: number) => [
  [w, s], [e, s], [e, n], [w, n], [w, s],
]

async function main() {
  console.log('Seeding "Untypical demo"…')

  const projectData = {
    name: 'Untypical demo',
    description:
      'Ashfield Park, Phase 2 — 240 homes on the eastern edge of Wellingborough, 14 months into construction. Demonstration project: live construction-disruption response.',
    latitude: CENTRE.lat,
    longitude: CENTRE.lng,
    mapZoom: 16,
    status: 'LIVE' as const,
    embedEnabled: true,
    allowPins: true,
    allowDrawing: true,
    issuesEnabled: true,
    // Deliberately no issueNotifyEmails: this is a demo project and test
    // reports must never email anyone. Set it in Website settings if wanted.
    embedPrimaryColor: '#9F1D35',
    embedFontFamily: 'Inter',
    embedDefaultSatellite: true,
  }

  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: projectData,
    create: { id: PROJECT_ID, ...projectData },
  })

  // Project sending address (skip silently if taken by another project)
  try {
    await prisma.project.update({ where: { id: PROJECT_ID }, data: { emailLocalPart: 'untypicaldemo' } })
  } catch {
    console.log('emailLocalPart "untypicaldemo" unavailable — left unset')
  }

  // Give every admin-capable account access (idempotent)
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

  // --- map layers ---------------------------------------------------------
  await prisma.geoLayer.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Ashfield Park red line',
      type: 'boundary',
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: 'Ashfield Park red line' },
          geometry: { type: 'Polygon', coordinates: [rect(52.3003, -0.6693, 52.3055, -0.6607)] },
        }],
      },
      style: { fillColor: '#9F1D35', strokeColor: '#9F1D35', fillOpacity: 0.05, strokeWidth: 2 },
      visible: true,
    },
  })
  await prisma.geoLayer.create({
    data: {
      projectId: PROJECT_ID,
      name: 'Phase 2 construction area',
      type: 'plot',
      geojson: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {
            name: 'Phase 2 construction area',
            status: 'Under construction',
            blurb: 'Groundworks and piling for plots 84–160. Site entrance and haul route from Milton Road.',
          },
          geometry: { type: 'Polygon', coordinates: [rect(52.3006, -0.6688, 52.3048, -0.662)] },
        }],
      },
      style: { fillColor: '#D97706', strokeColor: '#D97706', fillOpacity: 0.15, strokeWidth: 2 },
      visible: true,
    },
  })

  // --- construction-issue reports -----------------------------------------
  type Issue = {
    at: { lat: number; lng: number }
    category: string
    comment: string
    name: string
    email: string
    day: number
    hour?: number
    votes?: number
    approved?: boolean // default true
    resolved?: { day: number; notes: string }
    polygon?: number[][] // ring, [lng,lat]
    mailing?: boolean
  }

  const ISSUES: Issue[] = [
    // -- Cluster A: site entrance / Milton Road haul route --
    {
      at: ENTRANCE, category: 'traffic', day: 14, hour: 8, votes: 12,
      name: 'Karen Bloor', email: 'karen.bloor@example.com', mailing: true,
      comment: 'Mud all over Milton Road again this morning from the site entrance down to the mini-roundabout. Cars are skidding on it and it sprays up over the pavement. This has been going on for a fortnight.',
      resolved: { day: 11, notes: 'Wheel wash relocated to the site exit and a road sweeper now runs the Milton Road stretch twice daily (7:30am and 4pm). Condition checked each morning by the site manager.' },
    },
    {
      at: jitter(ENTRANCE, 2), category: 'traffic', day: 3, hour: 7, votes: 14,
      name: 'Dev Patel', email: 'dev.patel@example.com', mailing: true,
      comment: 'HGVs queuing back past the mini-roundabout from 7:20 this morning waiting for the gate to open. Nobody could get out of Milton Road for twenty minutes. Why are they arriving before the site opens?',
    },
    {
      at: jitter(ENTRANCE, 3), category: 'traffic', day: 2, hour: 16, votes: 9,
      name: 'Lynne Craddock', email: 'lynne.craddock@example.com',
      comment: 'A delivery lorry mounted the verge opposite number 42 to pass a parked car and has churned the whole thing up. Second time — the verge is now just mud.',
    },
    {
      at: jitter(ENTRANCE, 4), category: 'traffic', day: 9, hour: 9, votes: 6,
      name: 'Marcus Webb', email: 'marcus.webb@example.com',
      comment: 'Contractor vans parked across our driveways again on Milton Road. We have asked the drivers directly and get shrugs.',
      resolved: { day: 7, notes: 'All contractor and trade parking moved inside the site compound. Hauliers instructed that Milton Road parking is a removal-from-site matter.' },
    },
    {
      at: jitter(ENTRANCE, 5), category: 'dust',
      day: 4, hour: 13, votes: 7,
      name: 'Sofia Andersson', email: 'sofia.andersson@example.com', mailing: true,
      comment: 'Fine grey dust over every car and windowsill along this stretch whenever it is dry and the wind is from the east. It is coming off the stockpiles by the entrance.',
      polygon: [
        [-0.6702, 52.3004], [-0.6684, 52.3004], [-0.6684, 52.3012], [-0.6702, 52.3012], [-0.6702, 52.3004],
      ],
    },
    {
      at: jitter(ENTRANCE, 6), category: 'dust', day: 12, hour: 11, votes: 4,
      name: 'Tim Osei', email: 'tim.osei@example.com',
      comment: 'Dust cloud from the crushing operation drifting straight across the road on Saturday. You could taste it.',
      resolved: { day: 10, notes: 'Dampening-down now runs whenever the crusher operates and outbound loads are sheeted. Crushing paused when wind exceeds the dust-management threshold.' },
    },
    {
      at: jitter(ENTRANCE, 7), category: 'safety', day: 1, hour: 19,
      name: 'Gary Truelove', email: 'gary.truelove@example.com', approved: false,
      comment: 'Nearly clipped by a tipper swinging wide out of the entrance tonight at about 6pm. It is getting dark earlier and there is no banksman on the gate after 5.',
    },
    {
      at: jitter(ENTRANCE, 8), category: 'other', day: 5, hour: 15, votes: 2,
      name: 'Janet Mercer', email: 'janet.mercer@example.com',
      comment: 'The welfare units by the entrance gate smell terrible on warm afternoons. Is the servicing schedule actually being kept to?',
    },

    // -- Cluster B: Orchard Close, northern boundary --
    {
      at: ORCHARD, category: 'noise', day: 2, hour: 6, votes: 13,
      name: 'Sarah Whitfield', email: 'sarah.whitfield@example.com', mailing: true,
      comment: 'Piling started at 6:45 again this morning. The permitted hours notice on the hoarding says 8am. Our whole house vibrates — we have a six-month-old. Third time this week.',
    },
    {
      at: jitter(ORCHARD, 11), category: 'noise', day: 8, hour: 7, votes: 10,
      name: 'Bill Hartley', email: 'bill.hartley@example.com',
      comment: 'Piling rig running well before 7am on Tuesday and Wednesday. The vibration knocked pictures crooked. This is outside the hours on the consent.',
      resolved: { day: 5, notes: 'Piling rescheduled to start no earlier than 8am, confirmed with the piling subcontractor in writing. Site manager checks the first rig start each morning and logs it.' },
    },
    {
      at: jitter(ORCHARD, 12), category: 'hours', day: 1, hour: 9, votes: 8,
      name: 'Meera Shah', email: 'meera.shah@example.com', mailing: true,
      comment: 'Two delivery lorries unloading steel at 8:30 on Sunday morning. Sunday working is not in the permitted hours as far as we were told.',
    },
    {
      at: jitter(ORCHARD, 13), category: 'hours', day: 6, hour: 18, votes: 5,
      name: 'Colin Drury', email: 'colin.drury@example.com',
      comment: 'Deliveries arriving after 6pm most evenings this week, reversing and banging tailgates until nearly 7.',
      resolved: { day: 4, notes: 'Delivery curfew agreed with all hauliers: no arrivals before 8am or after 5:30pm, and none on Sundays. Gate log now records every vehicle in and out.' },
    },
    {
      at: jitter(ORCHARD, 14), category: 'noise', day: 5, hour: 14, votes: 6,
      name: 'Angela Boyce', email: 'angela.boyce@example.com',
      comment: 'Reversing bleepers constant all day at the back of ours. I understand they are a safety requirement but eight hours without a break is wearing everyone down.',
    },
    {
      at: jitter(ORCHARD, 15), category: 'noise', day: 0, hour: 7,
      name: 'Stefan Kowalski', email: 'stefan.kowalski@example.com', approved: false,
      comment: 'Generator left running all night behind the plots nearest Orchard Close. Low hum all night, still going at 6 this morning.',
    },
    {
      at: jitter(ORCHARD, 16), category: 'damage', day: 3, hour: 10, votes: 4,
      name: 'Rob Jennings', email: 'rob.jennings@example.com',
      comment: 'New crack across our rear bedroom ceiling and another above the patio door since the vibro works started. House is 12 years old and had nothing before.',
    },
    {
      at: jitter(ORCHARD, 17), category: 'damage', day: 10, hour: 12, votes: 3,
      name: 'Pat Nolan', email: 'pat.nolan@example.com',
      comment: 'Fence panel at the end of our garden pushed over by materials stacked against the site side of it.',
      resolved: { day: 8, notes: 'Panel replaced and the storage area moved back two metres off the boundary. A pre-condition survey of the adjoining gardens has been booked for the remaining works.' },
    },
    {
      at: jitter(ORCHARD, 18), category: 'dust', day: 2, hour: 13, votes: 5,
      name: 'Helen Barrow', email: 'helen.barrow@example.com',
      comment: 'Cannot open the back windows at all this week — dust straight off the spoil heaps behind the hoarding.',
    },
    {
      at: jitter(ORCHARD, 19), category: 'noise', day: 16, hour: 9, votes: 2,
      name: 'Derek Muir', email: 'derek.muir@example.com',
      comment: 'Constant clatter from the scaffolding gang from first light, well before the site officially opens.',
      resolved: { day: 13, notes: 'Acoustic barrier extended along the northern hoarding and scaffold loading moved to after 9am on the boundary plots.' },
    },
    {
      at: jitter(ORCHARD, 20), category: 'noise', day: 4, hour: 6, votes: 3,
      name: 'Fiona Gallagher', email: 'fiona.gallagher@example.com',
      comment: 'Radio on full and shouting across the site from before 7am. The work noise is one thing but this is avoidable.',
    },
    {
      at: jitter(ORCHARD, 21), category: 'damage', day: 1, hour: 11,
      name: 'Tony Whelan', email: 'tony.whelan@example.com', approved: false,
      comment: 'Hairline cracks appearing along our block-paved drive nearest the site boundary. Want this recorded before the next phase of piling.',
    },

    // -- Cluster C: St Luke's Primary corner --
    {
      at: SCHOOL, category: 'safety', day: 2, hour: 8, votes: 11,
      name: 'Nadia Hussain', email: 'nadia.hussain@example.com', mailing: true,
      comment: 'HGVs turning into the site during school drop-off with no banksman on the corner. This morning one reversed across the pavement while children were walking past. Someone will be hurt.',
    },
    {
      at: jitter(SCHOOL, 31), category: 'safety', day: 7, hour: 15, votes: 9,
      name: 'James Corrigan', email: 'james.corrigan@example.com',
      comment: 'Deliveries arriving right at 3:15 school pick-up. The crossing by the site corner is chaos with lorries and parents at the same time.',
      resolved: { day: 5, notes: 'Banksman now posted at the school corner 8–9am and 3–4pm on school days, and deliveries are held outside those windows. Agreed with the school and logged with County Highways.' },
    },
    {
      at: jitter(SCHOOL, 32), category: 'safety', day: 1, hour: 16, votes: 6,
      name: 'Beth Ellery', email: 'beth.ellery@example.com',
      comment: 'The new hoarding panel by the crossing blocks the sightline — you cannot see traffic coming from the site entrance until you are on the road.',
    },
    {
      at: jitter(SCHOOL, 33), category: 'traffic', day: 6, hour: 8, votes: 3,
      name: 'Oliver Stanton', email: 'oliver.stanton@example.com',
      comment: 'Parents now park all along the far side because of the site traffic, so the road narrows to one lane exactly at drop-off. Needs a crossing patrol or timed delivery ban.',
    },

    // -- scattered --
    {
      at: jitter(CENTRE, 41, 0.003), category: 'hours', day: 13, hour: 14, votes: 1,
      name: 'Ruth Calder', email: 'ruth.calder@example.com',
      comment: 'Is Saturday afternoon working now standard? The consent summary we were given said Saturday mornings only.',
    },
    {
      at: jitter(CENTRE, 42, 0.003), category: 'traffic', day: 8, hour: 10, votes: 2,
      name: 'Ian Frobisher', email: 'ian.frobisher@example.com',
      comment: 'Sat-navs are sending site lorries down Glebe Lane which is single track with passing places. Two got stuck nose to nose on Thursday.',
    },
    {
      at: jitter(CENTRE, 43, 0.003), category: 'dust', day: 15, hour: 12, votes: 1,
      name: 'Val Emery', email: 'val.emery@example.com',
      comment: 'Washing on the line ruined twice this month by dust blowing across from the site. Small thing but it adds up.',
    },
    {
      at: jitter(CENTRE, 44, 0.003), category: 'other', day: 3, hour: 21, votes: 2,
      name: 'Craig Donnelly', email: 'craig.donnelly@example.com',
      comment: 'The tower lighting rig by the compound shines straight into our upstairs windows after dark.',
    },
    {
      at: jitter(CENTRE, 45, 0.003), category: 'other', day: 20, hour: 10, votes: 1,
      name: 'Moira Petrie', email: 'moira.petrie@example.com',
      comment: 'The public footpath diversion signs blew down weeks ago and walkers keep ending up at the site fence.',
      resolved: { day: 17, notes: 'Diversion signage replaced with fixed posts at both ends of the footpath and added to the weekly site walk checklist.' },
    },
  ]

  let issueCount = 0
  for (const issue of ISSUES) {
    const created = await prisma.publicPin.create({
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
        votes: issue.votes ?? 0,
        approved: issue.approved !== false,
        resolved: Boolean(issue.resolved),
        resolvedAt: issue.resolved ? d(issue.resolved.day, 17, 0) : null,
        resolvedNotes: issue.resolved?.notes ?? null,
        gdprConsent: true,
        gdprConsentDate: d(issue.day, issue.hour ?? 12, 5),
        createdAt: d(issue.day, issue.hour ?? 12, 5),
      },
    })
    issueCount++
    if (issue.mailing) {
      await prisma.subscriber.create({
        data: {
          projectId: PROJECT_ID,
          email: issue.email,
          name: issue.name,
          source: 'issue_report',
          sourceId: created.id,
          gdprConsent: true,
          gdprConsentDate: d(issue.day, issue.hour ?? 12, 5),
        },
      })
    }
  }
  console.log(`Issue reports: ${issueCount}`)

  // --- general map feedback (kept separate from the issue log) ------------
  const FEEDBACK: Array<{ at: { lat: number; lng: number }; category: string; comment: string; name?: string; day: number; votes?: number }> = [
    { at: jitter(CENTRE, 51, 0.004), category: 'positive', day: 26, votes: 5, name: 'Grace Lin', comment: 'The new play park in Phase 1 is genuinely good — busy every evening. Credit where due.' },
    { at: jitter(CENTRE, 52, 0.004), category: 'positive', day: 19, votes: 3, comment: 'Pleased to see the affordable homes going in first this phase rather than last.' },
    { at: jitter(CENTRE, 53, 0.004), category: 'negative', day: 22, votes: 7, name: 'Hugh Bassett', comment: 'Density on the eastern parcels looks much tighter than the exhibition boards showed.' },
    { at: jitter(CENTRE, 54, 0.004), category: 'negative', day: 12, votes: 4, comment: 'The old hedgerow along the eastern boundary has gone. It was full of birds. Was that in the approved plans?' },
    { at: jitter(CENTRE, 55, 0.004), category: 'negative', day: 9, votes: 6, name: 'Susan Meadows', comment: 'Surface water already pools at the bottom of the hill after rain. 240 more roofs will make it worse unless the drainage really is oversized.' },
    { at: jitter(CENTRE, 56, 0.004), category: 'question', day: 16, votes: 2, comment: 'When does the spine road open through to the A509? That would take site traffic off Milton Road.' },
    { at: jitter(CENTRE, 57, 0.004), category: 'question', day: 7, votes: 3, name: 'Priti Rao', comment: 'Will there be additional school places to go with Phase 2, or are the new families expected to travel?' },
    { at: jitter(CENTRE, 58, 0.004), category: 'comment', day: 28, votes: 1, comment: 'Please keep the two mature oaks by the northern footpath — they are the best thing on the site.' },
  ]
  for (const fb of FEEDBACK) {
    await prisma.publicPin.create({
      data: {
        projectId: PROJECT_ID,
        mode: 'feedback',
        shapeType: 'pin',
        latitude: fb.at.lat,
        longitude: fb.at.lng,
        category: fb.category,
        comment: fb.comment,
        name: fb.name ?? null,
        votes: fb.votes ?? 0,
        approved: true,
        gdprConsent: true,
        gdprConsentDate: d(fb.day, 12, 0),
        createdAt: d(fb.day, 12, 0),
      },
    })
  }
  console.log(`Feedback pins: ${FEEDBACK.length}`)

  // --- stakeholders + the 48-hour engagement log --------------------------
  type Eng = { type: string; title: string; description?: string; day: number; hour: number; minute?: number; outcome?: string; nextAction?: string }
  const STAKEHOLDERS: Array<{
    name: string; role?: string; organization?: string; email?: string; phone?: string
    type: string; category: string; influence: number; interest: number; notes?: string
    at?: { lat: number; lng: number }
    engagements: Eng[]
  }> = [
    {
      name: 'Cllr Margaret Doyle', role: 'Ward councillor, Ashfield East', organization: 'North Northamptonshire Council',
      email: 'margaret.doyle@example.com', phone: '01933 000001', type: 'authority', category: 'opposed', influence: 4, interest: 5,
      notes: 'Leading the residents’ campaign publicly. Quoted in the Chronicle twice. Wants visible, dated commitments — not reassurance.',
      engagements: [
        { type: 'call', title: 'Call on Milton Road disruption', day: 1, hour: 8, minute: 30, description: 'First direct conversation since the Chronicle piece. Walked through the issue log category by category.', outcome: 'Concerns heard in full: early piling, HGVs at school run, mud on Milton Road. Agreed a joint site walk and a weekly written update she can forward to residents.', nextAction: 'Invite to Thursday site walk; share the mitigation tracker weekly' },
        { type: 'email', title: 'Mitigation tracker sent', day: 0, hour: 17, minute: 10, description: 'Sent the dated mitigation tracker and a link to the public issue map showing resolved items.', outcome: 'Acknowledged same evening.' },
      ],
    },
    {
      name: 'Cllr James Obi', role: 'Ward councillor, Ashfield West', organization: 'North Northamptonshire Council',
      email: 'james.obi@example.com', phone: '01933 000002', type: 'authority', category: 'undecided', influence: 4, interest: 4,
      notes: 'Measured so far. Focused on the school-corner safety issue specifically.',
      engagements: [
        { type: 'call', title: 'Call on school-corner safety', day: 1, hour: 9, minute: 15, outcome: 'Set out the banksman and delivery-window plan agreed with the school. He will hold comment until he sees it operating.', nextAction: 'Confirm in writing once banksman cover has run for a week' },
      ],
    },
    {
      name: 'Sarah Bell MP', role: 'Member of Parliament', organization: 'Wellingborough & Rushden constituency office',
      email: 'sarah.bell.office@example.com', type: 'authority', category: 'neutral', influence: 5, interest: 3,
      notes: 'Office has received constituent letters. No public comment yet.',
      engagements: [
        { type: 'email', title: 'Briefing note to constituency office', day: 1, hour: 17, minute: 30, description: 'One-page factual briefing: what went wrong, what is being fixed, dated commitments, single point of contact.', outcome: 'Office acknowledged; asked to be copied on remediation updates.', nextAction: 'Copy office on the weekly update' },
      ],
    },
    {
      name: 'Peter Hale', role: 'Chair', organization: 'Ashfield Residents’ Association',
      email: 'peter.hale@example.com', phone: '01933 000004', type: 'community', category: 'opposed', influence: 3, interest: 5,
      notes: 'Compiled the residents’ complaint dossier. Firm but constructive in person — wants a named contact, not a call centre.',
      engagements: [
        { type: 'meeting', title: 'Site walk: haul road and northern boundary', day: 1, hour: 14, description: 'Walked Milton Road, the site entrance and the Orchard Close boundary with the site manager. Stopped at each complaint location from the dossier.', outcome: 'Agreed on the spot: wheel wash at exit, sweeper twice daily, piling from 8am, delivery curfew, named site contact with a direct number. Follow-up walk in two weeks.', nextAction: 'Letter drop confirming all commitments by Friday' },
      ],
    },
    {
      name: 'Teresa Okafor', role: 'Headteacher', organization: 'St Luke’s Primary School',
      email: 'head@example.com', phone: '01933 000005', type: 'community', category: 'neutral', influence: 3, interest: 4,
      at: SCHOOL,
      engagements: [
        { type: 'meeting', title: 'School-run safety meeting', day: 0, hour: 11, minute: 30, description: 'Met at the school with the site manager. Reviewed the corner sightline and delivery timings against drop-off and pick-up.', outcome: 'Banksman posted 8–9am and 3–4pm on school days; deliveries held outside those windows; hoarding panel by the crossing to be set back this week.', nextAction: 'Check in after one week of banksman cover' },
      ],
    },
    {
      name: 'Dana Price', role: 'Regional journalist', organization: 'Northampton Chronicle',
      email: 'dana.price@example.com', type: 'other', category: 'neutral', influence: 3, interest: 4,
      notes: 'Two critical pieces so far, accurately reported. Responds well to specifics and access.',
      engagements: [
        { type: 'call', title: 'Statement and mitigation list ahead of print deadline', day: 1, hour: 16, description: 'Provided an on-record statement acknowledging the disruption, plus the dated mitigation list and the public issue-map link.', outcome: 'Statement carried in full. Offered a site visit to see the measures working.', nextAction: 'Host site visit next week' },
      ],
    },
    {
      name: 'Chris Fenwick', role: 'National correspondent', organization: 'National broadsheet',
      email: 'chris.fenwick@example.com', type: 'other', category: 'undecided', influence: 5, interest: 3,
      notes: 'Researching whether Ashfield reflects a group-wide pattern. Group communications lead on this relationship; regional team provides evidence.',
      engagements: [
        { type: 'call', title: 'Background briefing (group comms lead)', day: 0, hour: 10, minute: 30, description: 'On background: what happened here, the remediation programme, and the group-wide community standards being applied.', outcome: 'Agreed to hold the story pending evidence of remediation over the next fortnight. Wants the documented before/after record, not assurances.', nextAction: 'Send the resolved-issue log and site-walk record in ten days' },
      ],
    },
    {
      name: 'Alan Whitcombe', role: 'Chair', organization: 'Ashfield Parish Council',
      email: 'alan.whitcombe@example.com', type: 'authority', category: 'undecided', influence: 2, interest: 4,
      engagements: [
        { type: 'email', title: 'Update to parish council', day: 0, hour: 9, minute: 40, outcome: 'Standing item added to the next parish meeting; invited a representative on the Thursday site walk.' },
      ],
    },
    {
      name: 'Priya Nair', role: 'Highways officer', organization: 'North Northamptonshire Council — Highways',
      email: 'priya.nair@example.com', type: 'authority', category: 'neutral', influence: 3, interest: 3,
      engagements: [
        { type: 'call', title: 'HGV routing review', day: 0, hour: 12, minute: 15, description: 'Reviewed the approved routing plan against the Glebe Lane sat-nav problem and the school-corner timings.', outcome: 'Temporary advisory signage agreed for Glebe Lane; routing map re-issued to all hauliers with the delivery curfew.', nextAction: 'Confirm signage installed; monitor gate log for compliance' },
      ],
    },
    {
      name: 'Gwen Harris', role: 'Residents’ representative, Orchard Close', organization: 'Orchard Close residents',
      email: 'gwen.harris@example.com', type: 'community', category: 'opposed', influence: 2, interest: 5,
      at: ORCHARD,
      notes: 'Coordinates the Orchard Close complaints. Most affected street — piling noise and dust.',
      engagements: [
        { type: 'letter', title: 'Letter drop: Orchard Close and Milton Road', day: 0, hour: 15, description: 'Hand-delivered letter to ~90 households setting out each commitment with dates, the named site contact and direct line, and the public issue-map link for reporting.', outcome: 'Delivered with Gwen Harris accompanying. Several residents raised items on the doorstep — logged as new issue reports.', nextAction: 'Door-knock follow-up on the four damage claims this week' },
      ],
    },
    {
      name: 'Dave McAllister', role: 'Site manager', organization: 'Brayford Construction (principal contractor)',
      email: 'dave.mcallister@example.com', phone: '07700 900006', type: 'business', category: 'supporter', influence: 3, interest: 2,
      engagements: [
        { type: 'meeting', title: 'Mitigation planning meeting', day: 1, hour: 10, description: 'Full review of the issue log with the contractor before any external commitments were made.', outcome: 'Agreed and costed: wheel wash relocation, sweeper schedule, 8am piling start, banksman cover at the school corner, delivery curfew, boundary storage moved. All items given owners and dates.', nextAction: 'Daily check-in during the remediation fortnight' },
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
          date: d(e.day, e.hour, e.minute ?? 0),
          outcome: e.outcome ?? null,
          nextAction: e.nextAction ?? null,
        },
      })
      engagementCount++
    }
  }
  console.log(`Stakeholders: ${STAKEHOLDERS.length} (engagements: ${engagementCount})`)

  // --- enquiries: inbound only, no seeded replies -------------------------
  const ENQUIRIES: Array<{
    name: string; email: string; org?: string; phone?: string
    subject: string; message: string; category: string
    status: 'new' | 'open'; read: boolean; day: number; hour: number
  }> = [
    {
      name: 'Peter Hale', email: 'peter.hale@example.com', org: 'Ashfield Residents’ Association',
      subject: 'Formal complaint: sustained construction disruption, Milton Road and Orchard Close',
      message: 'On behalf of the Ashfield Residents’ Association I am submitting a compiled record of disruption over the past three weeks: piling before permitted hours on at least six dates, mud and dust on Milton Road, HGV movements during school drop-off, and two reports of property damage on Orchard Close. Residents have lost confidence in the site’s complaint line. We request a meeting on site, a named contact with authority to act, and a written response to each item within ten working days.',
      category: 'complaint', status: 'open', read: true, day: 2, hour: 9,
    },
    {
      name: 'Office of Cllr Margaret Doyle', email: 'margaret.doyle@example.com', org: 'North Northamptonshire Council',
      subject: 'Constituent complaints — Ashfield Park Phase 2: request for meeting',
      message: 'Cllr Doyle has received a substantial volume of correspondence from residents of Milton Road and Orchard Close regarding construction working hours, HGV routing and road cleanliness. She requests an urgent meeting with the project team and the principal contractor, and asks what immediate steps are being taken ahead of that meeting. Please respond to this office by Friday.',
      category: 'complaint', status: 'open', read: true, day: 1, hour: 11,
    },
    {
      name: 'Nadia Hussain', email: 'nadia.hussain@example.com',
      subject: 'Lorries at school drop-off — St Luke’s corner',
      message: 'I reported the HGV issue on your map but I want to raise it directly as well. This morning a lorry reversed across the pavement on the school corner while children were walking to St Luke’s. What is being done, specifically, before someone is seriously hurt? I am also writing to the school and to Cllr Obi.',
      category: 'complaint', status: 'new', read: false, day: 1, hour: 8,
    },
    {
      name: 'Rob Jennings', email: 'rob.jennings@example.com',
      subject: 'Property damage claim — 14 Orchard Close',
      message: 'Following my report on the issue map: we now have cracks in the rear bedroom ceiling and above the patio door which have appeared since the vibro compaction works began. I would like to know the process for a formal damage claim, whether a structural survey will be arranged at your cost, and who insures the works. Photographs available on request.',
      category: 'general', status: 'new', read: false, day: 0, hour: 10,
    },
    {
      name: 'Dana Price', email: 'dana.price@example.com', org: 'Northampton Chronicle',
      subject: 'Press enquiry: Ashfield Park construction complaints — deadline Thursday 4pm',
      message: 'I am preparing a follow-up piece on construction disruption at Ashfield Park Phase 2, including claims that piling has repeatedly started before permitted hours and that residents’ complaints have gone unanswered. Do you wish to comment? Specifically: (1) how many complaints have been received in the past month; (2) what action has been taken; (3) whether the group considers this site typical of its approach to communities. Deadline Thursday 4pm.',
      category: 'general', status: 'open', read: true, day: 1, hour: 13,
    },
  ]
  for (const q of ENQUIRIES) {
    await prisma.enquiry.create({
      data: {
        projectId: PROJECT_ID,
        submitterName: q.name,
        submitterEmail: q.email,
        submitterOrg: q.org ?? null,
        subject: q.subject,
        message: q.message,
        category: q.category,
        status: q.status,
        read: q.read,
        gdprConsent: true,
        gdprConsentDate: d(q.day, q.hour, 0),
        createdAt: d(q.day, q.hour, 0),
      },
    })
  }
  console.log(`Enquiries: ${ENQUIRIES.length} (inbound only, no seeded replies)`)

  // --- extra subscribers + a DRAFT update email ---------------------------
  const EXTRA_SUBSCRIBERS = [
    { email: 'grace.lin@example.com', name: 'Grace Lin', source: 'subscribe_embed', day: 24 },
    { email: 'susan.meadows@example.com', name: 'Susan Meadows', source: 'subscribe_embed', day: 9 },
    { email: 'peter.hale@example.com', name: 'Peter Hale', source: 'manual', day: 1 },
    { email: 'gwen.harris@example.com', name: 'Gwen Harris', source: 'manual', day: 1 },
  ]
  for (const s of EXTRA_SUBSCRIBERS) {
    await prisma.subscriber.upsert({
      where: { projectId_email: { projectId: PROJECT_ID, email: s.email } },
      create: {
        projectId: PROJECT_ID, email: s.email, name: s.name, source: s.source,
        gdprConsent: true, gdprConsentDate: d(s.day, 12, 0),
      },
      update: {},
    })
  }
  const subscriberCount = await prisma.subscriber.count({ where: { projectId: PROJECT_ID } })

  await prisma.campaign.create({
    data: {
      projectId: PROJECT_ID,
      subject: 'Construction update: what we’re changing this week at Ashfield Park',
      body: `Dear {{name}},

We have heard clearly from residents of Milton Road, Orchard Close and the St Luke’s school corner that construction disruption over recent weeks has not been acceptable. This is what is changing, from this week:

• Piling will not start before 8am. The first rig start is checked and logged every morning.
• A road sweeper now cleans the Milton Road stretch twice daily, and the wheel wash has moved to the site exit.
• Deliveries are held outside 8–9am and 3–4pm on school days, with a banksman on the St Luke’s corner at those times.
• No deliveries before 8am, after 5:30pm, or on Sundays.
• Contractor parking has moved inside the site compound.

Every report on the issue map gets looked at, and you can see what has been fixed — with dates — on the map itself. If something is wrong, please keep telling us there, or contact our named site contact directly.

Ashfield Park project team`,
      status: 'draft',
    },
  })
  console.log(`Subscribers: ${subscriberCount}; campaign: 1 draft (nothing seeded as sent)`)

  console.log(`\nDone. Project id: ${project.id}`)
  console.log(`Dashboard: /projects/${PROJECT_ID}`)
  console.log(`Issue reporter embed: /embed/${PROJECT_ID}/issues`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
