import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding test data...')

  // Get or create a test project
  let project = await prisma.project.findFirst()

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'High Street Redevelopment',
        description: 'Proposed mixed-use development on the former shopping centre site, including 200 residential units, retail space, and a new public square.',
        latitude: 51.5074,
        longitude: -0.1278,
        mapZoom: 15,
        embedEnabled: true,
      },
    })
    console.log('Created test project:', project.name)
  } else {
    console.log('Using existing project:', project.name)
  }

  // Clear existing test data
  await prisma.publicPin.deleteMany({ where: { projectId: project.id } })
  await prisma.enquiry.deleteMany({ where: { projectId: project.id } })
  console.log('Cleared existing feedback data')

  // Add Public Pins (map feedback) - spread across the project area
  const pins = [
    // === NORTH AREA (positive cluster) ===
    { comment: "Love the idea of a new public square! This area really needs more green space.", category: "positive", lat: 51.5120, lng: -0.1250 },
    { comment: "Great to see affordable housing included in the plans. Exactly what we need.", category: "positive", lat: 51.5125, lng: -0.1260 },
    { comment: "The modern design looks fantastic. Will really improve the high street.", category: "positive", lat: 51.5118, lng: -0.1245 },
    { comment: "Support this development - the old shopping centre was an eyesore!", category: "positive", lat: 51.5122, lng: -0.1255 },
    { comment: "Excellent heritage preservation. Shows respect for local history.", category: "positive", lat: 51.5115, lng: -0.1265 },
    { comment: "Finally some investment in our area. Long overdue!", category: "positive", lat: 51.5128, lng: -0.1248 },
    { comment: "The community spaces look wonderful. Great for families.", category: "positive", lat: 51.5112, lng: -0.1258 },
    { comment: "Love the sustainability features - solar panels and green roofs.", category: "positive", lat: 51.5119, lng: -0.1242 },

    // === SOUTH AREA (negative cluster) ===
    { comment: "Very concerned about traffic. Already congested, this will make it worse.", category: "negative", lat: 51.5020, lng: -0.1300 },
    { comment: "Where will everyone park? Only 100 spaces for 200 units is ridiculous.", category: "negative", lat: 51.5025, lng: -0.1310 },
    { comment: "Building too tall at 8 stories. Will block light to Oak Lane properties.", category: "negative", lat: 51.5018, lng: -0.1295 },
    { comment: "Schools already oversubscribed. This hasn't been addressed at all.", category: "negative", lat: 51.5028, lng: -0.1305 },
    { comment: "Construction noise will affect my business for years. Needs mitigation.", category: "negative", lat: 51.5015, lng: -0.1315 },
    { comment: "Loss of small businesses is concerning. What support is being offered?", category: "negative", lat: 51.5022, lng: -0.1290 },
    { comment: "Affordable housing should be 40% not 30%. Doesn't meet local needs.", category: "negative", lat: 51.5030, lng: -0.1298 },
    { comment: "This will destroy the character of our neighbourhood.", category: "negative", lat: 51.5012, lng: -0.1308 },
    { comment: "GP surgeries already full. No capacity for 200 more households.", category: "negative", lat: 51.5026, lng: -0.1318 },

    // === EAST AREA (mixed) ===
    { comment: "Good overall but worried about parking during construction.", category: "positive", lat: 51.5070, lng: -0.1180 },
    { comment: "Like the retail units but need independent shops, not chains.", category: "positive", lat: 51.5075, lng: -0.1175 },
    { comment: "Concerned about overlooking but design looks good.", category: "negative", lat: 51.5068, lng: -0.1190 },
    { comment: "Traffic concerns but the housing is needed.", category: "negative", lat: 51.5072, lng: -0.1185 },
    { comment: "Support if construction hours are reasonable.", category: "positive", lat: 51.5078, lng: -0.1170 },
    { comment: "Mixed feelings - good design but too dense.", category: "negative", lat: 51.5065, lng: -0.1195 },

    // === WEST AREA (mostly negative) ===
    { comment: "Strongly oppose. Too tall, too dense, wrong location.", category: "negative", lat: 51.5080, lng: -0.1380 },
    { comment: "Will devalue my property. Should step down heights.", category: "negative", lat: 51.5085, lng: -0.1375 },
    { comment: "Not enough green space. Just concrete boxes.", category: "negative", lat: 51.5078, lng: -0.1390 },
    { comment: "Infrastructure cannot cope. Roads, schools, GPs all at capacity.", category: "negative", lat: 51.5088, lng: -0.1385 },
    { comment: "Appreciate the consultation but still concerned.", category: "positive", lat: 51.5082, lng: -0.1370 },

    // === CENTRAL AREA (the main site - mixed) ===
    { comment: "This is the perfect location for mixed-use development.", category: "positive", lat: 51.5074, lng: -0.1278 },
    { comment: "Excited about the new public square!", category: "positive", lat: 51.5076, lng: -0.1282 },
    { comment: "Will bring much needed jobs to the area.", category: "positive", lat: 51.5072, lng: -0.1275 },
    { comment: "Worried about construction disruption to my daily commute.", category: "negative", lat: 51.5078, lng: -0.1270 },
    { comment: "Need more detail on the transport improvements.", category: "question", lat: 51.5070, lng: -0.1285 },
    { comment: "When will construction start?", category: "question", lat: 51.5075, lng: -0.1268 },
    { comment: "Will there be a GP surgery in the retail units?", category: "question", lat: 51.5079, lng: -0.1280 },
    { comment: "What type of retail is planned?", category: "question", lat: 51.5071, lng: -0.1290 },
  ]

  for (const pin of pins) {
    await prisma.publicPin.create({
      data: {
        projectId: project.id,
        latitude: pin.lat,
        longitude: pin.lng,
        category: pin.category,
        comment: pin.comment,
        name: `Resident ${Math.floor(Math.random() * 100)}`,
        email: `resident${Math.floor(Math.random() * 1000)}@example.com`,
        approved: true,
        votes: Math.floor(Math.random() * 20),
      },
    })
  }
  console.log(`Created ${pins.length} public pins`)

  // Add Enquiries (inbox messages)
  const enquiries = [
    {
      name: "Sarah Thompson",
      email: "sarah.thompson@email.com",
      subject: "Parking concerns for Oak Lane residents",
      message: "As a resident of Oak Lane for 15 years, I'm extremely worried about the parking situation. We already struggle to find spaces in the evening, and adding 200 homes with only 100 parking spaces will make this impossible. What provisions are being made for existing residents? Will there be permit zones? I'd like a formal response please.",
      category: "objection",
      priority: "high",
    },
    {
      name: "David Chen",
      email: "d.chen@business.co.uk",
      subject: "Business relocation support",
      message: "I run Chen's Electronics on the current site. We've been here for 25 years and employ 5 local people. What support is available for businesses being displaced? Will there be affordable retail units in the new development? I need clarity on this soon as my current lease ends in 6 months.",
      category: "general",
      priority: "high",
    },
    {
      name: "Emma Wilson",
      email: "emma.w@gmail.com",
      subject: "Excited about the community space",
      message: "I just wanted to say how excited I am about the plans for the public square! Our area really lacks places for the community to come together. Will there be any programming for the space - like markets or events? I'd love to help organise community activities if there's opportunity.",
      category: "support",
      priority: "normal",
    },
    {
      name: "James Morrison",
      email: "j.morrison@outlook.com",
      subject: "Construction hours complaint",
      message: "I work night shifts at the hospital. The proposed construction hours of 7am-7pm will make it impossible for me to sleep. Can these be changed to 8am-6pm? Also, what about weekend working? I really need this addressed or I may have to move.",
      category: "complaint",
      priority: "normal",
    },
    {
      name: "Local History Society",
      email: "info@localhistory.org",
      subject: "Heritage preservation requirements",
      message: "We're pleased to see the Victorian facade being retained. However, we'd like clarification on exactly which elements will be preserved. The original shopfronts at numbers 45-49 are particularly significant. We'd welcome a meeting to discuss this in detail.",
      category: "planning",
      priority: "normal",
    },
    {
      name: "Dr. Patel",
      email: "dr.patel@nhs.net",
      subject: "Healthcare provision question",
      message: "As a local GP, I'm concerned about healthcare capacity. Our practice is already at 120% capacity. Has there been any assessment of healthcare needs? Is there space allocated for a medical facility in the plans? We would be interested in potentially opening a branch surgery.",
      category: "planning",
      priority: "high",
    },
    {
      name: "Green Streets Campaign",
      email: "contact@greenstreets.org",
      subject: "Environmental sustainability measures",
      message: "We support sustainable development in the area. Can you confirm: 1) What percentage of homes will have solar panels? 2) Will there be electric vehicle charging points? 3) What's the target for carbon neutrality? 4) Are there plans for rainwater harvesting? We'd like detailed information for our members.",
      category: "general",
      priority: "normal",
    },
    {
      name: "Mary Johnson",
      email: "mary.j@retired.net",
      subject: "Accessibility concerns",
      message: "I'm 78 and use a mobility scooter. The current pavements are already difficult. Will the new development have proper dropped kerbs and wide enough paths? Also concerned about the gradient on the new pedestrian routes shown in the plans.",
      category: "general",
      priority: "normal",
    },
  ]

  for (const enquiry of enquiries) {
    await prisma.enquiry.create({
      data: {
        projectId: project.id,
        submitterName: enquiry.name,
        submitterEmail: enquiry.email,
        subject: enquiry.subject,
        message: enquiry.message,
        category: enquiry.category,
        priority: enquiry.priority,
        status: 'new',
      },
    })
  }
  console.log(`Created ${enquiries.length} enquiries`)

  // Create a feedback form with responses
  const form = await prisma.feedbackForm.create({
    data: {
      projectId: project.id,
      name: 'Public Consultation Survey',
      active: true,
      fields: [
        { id: 'overall', label: 'Overall, do you support this development?', type: 'radio', options: ['Strongly support', 'Support', 'Neutral', 'Oppose', 'Strongly oppose'], required: true },
        { id: 'likes', label: 'What do you like most about the proposals?', type: 'textarea', required: false },
        { id: 'concerns', label: 'What concerns do you have?', type: 'textarea', required: false },
        { id: 'suggestions', label: 'Do you have any suggestions for improvement?', type: 'textarea', required: false },
        { id: 'local', label: 'Do you live or work within 1 mile of the site?', type: 'radio', options: ['Yes', 'No'], required: true },
        { id: 'email', label: 'Email (optional, for updates)', type: 'email', required: false },
      ],
    },
  })

  const formResponses = [
    { overall: 'Strongly support', likes: 'Finally something being done with that derelict site. The mixed-use approach is perfect for bringing life back to the high street.', concerns: 'Just worried about parking during construction.', suggestions: 'Consider underground parking to maximise green space.', local: 'Yes' },
    { overall: 'Support', likes: 'The affordable housing provision is good. Nice to see family-sized units included.', concerns: 'Traffic on the high street is already bad. This will make it worse.', suggestions: 'Better cycling infrastructure would help reduce car dependence.', local: 'Yes' },
    { overall: 'Oppose', likes: 'The public square is a nice idea.', concerns: 'Too tall, too dense. Will completely change the character of the area. Not enough parking. Schools are full. Doctors are full. Infrastructure cannot cope.', suggestions: 'Reduce to 5 stories maximum. Provide 1:1 parking ratio.', local: 'Yes' },
    { overall: 'Strongly oppose', likes: 'Nothing. This development is wrong for this area.', concerns: 'Loss of light to neighbouring properties. Increased traffic. Loss of community feel. Profits for developers at expense of residents.', suggestions: 'Start again with genuine community input.', local: 'Yes' },
    { overall: 'Support', likes: 'Good that the Victorian elements are being kept. Shows respect for heritage.', concerns: 'Would like to see more green space integrated throughout, not just in the square.', suggestions: 'Add roof gardens and green walls to improve biodiversity.', local: 'Yes' },
    { overall: 'Neutral', likes: 'Some aspects are good - the retail units will be useful.', concerns: 'Unsure about the modern design - will it age well? Also concerned about build quality.', suggestions: 'Use high-quality materials. Publish detailed specifications.', local: 'Yes' },
    { overall: 'Strongly support', likes: 'This is exactly what we need! More homes, more shops, better public spaces. The area has been neglected for too long.', concerns: 'Just make sure the affordable homes are truly affordable and not just discounted market rates.', suggestions: 'Partner with housing associations for the affordable element.', local: 'No' },
    { overall: 'Support', likes: 'Good density for a town centre location. Sensible to build up near transport links.', concerns: 'Need to ensure adequate cycle parking and public transport improvements.', suggestions: 'Work with bus companies to increase frequency on Route 52.', local: 'Yes' },
    { overall: 'Oppose', likes: 'The environmental features are positive.', concerns: 'My property will be overlooked. 8 stories is far too high for this location. Will devalue my home.', suggestions: 'Step down the height towards existing houses.', local: 'Yes' },
    { overall: 'Support', likes: 'Love the community focus and public spaces. We need more places to meet neighbours.', concerns: 'Hope the retail isn\'t just chain stores. We need independent shops.', suggestions: 'Reserve some units for local independent businesses at affordable rents.', local: 'Yes' },
  ]

  for (const response of formResponses) {
    await prisma.feedbackResponse.create({
      data: {
        formId: form.id,
        data: response,
      },
    })
  }
  console.log(`Created ${formResponses.length} form responses`)

  // Add some subscribers to the mailing list
  const subscribers = [
    { email: 'sarah.thompson@email.com', name: 'Sarah Thompson', source: 'enquiry' },
    { email: 'david.chen@business.co.uk', name: 'David Chen', source: 'enquiry' },
    { email: 'interested@local.com', name: 'Local Resident', source: 'manual' },
    { email: 'updates@please.com', name: 'Newsletter Fan', source: 'public_pin' },
    { email: 'community@watch.org', name: 'Community Watch', source: 'manual' },
  ]

  for (const sub of subscribers) {
    await prisma.subscriber.upsert({
      where: { projectId_email: { projectId: project.id, email: sub.email } },
      update: {},
      create: {
        projectId: project.id,
        email: sub.email,
        name: sub.name,
        source: sub.source,
        subscribed: true,
      },
    })
  }
  console.log(`Created ${subscribers.length} subscribers`)

  console.log('\n✅ Test data seeded successfully!')
  console.log(`Project: ${project.name}`)
  console.log(`Public Pins: ${pins.length}`)
  console.log(`Enquiries: ${enquiries.length}`)
  console.log(`Form Responses: ${formResponses.length}`)
  console.log(`Subscribers: ${subscribers.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
