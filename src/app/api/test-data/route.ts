import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const testFeedback = [
  // Traffic concerns
  { category: 'concern', comment: "The proposed access road onto Church Lane will cause significant congestion during school drop-off times. The junction already struggles with traffic from 8-9am and this development will make it unbearable." },
  { category: 'concern', comment: "I'm worried about the additional 200+ cars this development will bring. Our local roads weren't designed for this volume of traffic and there's already nowhere to park on weekends." },
  { category: 'concern', comment: "HGV construction traffic through our village will be dangerous for children walking to school. What measures will be in place to manage this?" },

  // Environmental concerns
  { category: 'concern', comment: "The site is home to protected great crested newts and bats. Has an ecological survey been conducted? The proposed drainage could destroy the existing pond habitat." },
  { category: 'concern', comment: "Removing the mature oak trees along the boundary will devastate local wildlife corridors. These trees are over 100 years old and should be protected." },
  { category: 'concern', comment: "The site currently absorbs significant rainfall. Building on this greenfield site will increase flood risk to properties on Mill Lane which already flood during heavy rain." },

  // Design concerns
  { category: 'concern', comment: "The proposed 3-storey apartment block is completely out of character with the existing Victorian cottages. It will dominate the skyline and destroy the village aesthetic." },
  { category: 'concern', comment: "The density of 45 dwellings per hectare is far too high for a rural location. This looks like urban housing dumped in the countryside." },

  // Housing support
  { category: 'support', comment: "We desperately need more affordable housing in this area. My adult children can't afford to live locally and have had to move away. I support this development." },
  { category: 'support', comment: "The inclusion of 35% affordable housing is welcome. Young families are being priced out of our community and this will help address that." },
  { category: 'support', comment: "As a local employer, I support new housing. We struggle to recruit staff because there's nowhere for them to live within a reasonable distance." },

  // Infrastructure concerns
  { category: 'concern', comment: "The local GP surgery is already oversubscribed with 3-week waiting times. Adding 500+ new residents without additional healthcare provision is unacceptable." },
  { category: 'concern', comment: "St Mary's Primary School is at capacity. Where will the children from this development go? The nearest alternative is 5 miles away." },

  // Noise concerns
  { category: 'concern', comment: "The proposed play area is directly adjacent to my boundary. I'm concerned about noise levels, particularly during summer evenings." },

  // Non-material objections (to test classification)
  { category: 'concern', comment: "This development will destroy the value of my property. I paid a premium for countryside views and now I'll be looking at a housing estate." },
  { category: 'concern', comment: "The developer only cares about profit, not our community. They built shoddy houses on their last project." },
  { category: 'concern', comment: "I've lived here for 40 years and don't want anything to change. We don't need more people here." },

  // Positive aspects
  { category: 'support', comment: "The proposed community orchard and wildflower meadow are excellent additions. It's good to see biodiversity net gain being taken seriously." },
  { category: 'support', comment: "I'm pleased to see electric vehicle charging points included for every dwelling. This is forward-thinking and necessary for net zero." },

  // Mixed/neutral
  { category: 'comment', comment: "Could the developers confirm what the proposed opening hours for the construction site will be? I work night shifts and need to sleep during the day." },
  { category: 'comment', comment: "Will there be a residents' meeting to discuss the S106 contributions? I'd like to understand what community benefits are being proposed." },
]

const testFormSubmissions = [
  { name: 'Sarah Mitchell', email: 'sarah.m@example.com', feedback: "I strongly support this development. We desperately need more affordable homes for young families in the area. My daughter has been on the housing list for 3 years." },
  { name: 'James Thompson', email: 'james.t@example.com', feedback: "Concerned about the impact on local traffic. Church Lane is already congested during rush hour. What traffic calming measures are proposed?" },
  { name: 'Emily Watson', email: 'emily.w@example.com', feedback: "The green spaces look wonderful. I hope the wildflower meadow will be properly maintained and accessible to all residents." },
  { name: 'Robert Davies', email: 'robert.d@example.com', feedback: "Worried about flooding. This field has always absorbed water from heavy rain. Building 150 homes here will make existing drainage problems worse." },
  { name: 'Margaret Clarke', email: 'margaret.c@example.com', feedback: "I object to the 3-storey flats. They're completely out of character with our Victorian village. The design should be limited to 2 storeys maximum." },
  { name: 'David Wilson', email: 'david.w@example.com', feedback: "As a local business owner, I welcome new residents. Our shops are struggling and need more customers to survive." },
  { name: 'Patricia Brown', email: 'patricia.b@example.com', feedback: "What about school places? The primary school is already oversubscribed. Where will all these new children go?" },
  { name: 'Michael Green', email: 'michael.g@example.com', feedback: "Please consider adding more cycle paths connecting to the town centre. This would reduce car dependency and benefit everyone." },
  { name: 'Susan Taylor', email: 'susan.t@example.com', feedback: "The proposed community orchard is a lovely idea. I'd be happy to volunteer to help maintain it." },
  { name: 'Christopher Harris', email: 'chris.h@example.com', feedback: "Has an ecological survey been done? I've seen bats flying over the site at dusk and there may be protected species present." },
  { name: 'Jennifer Adams', email: 'jennifer.a@example.com', feedback: "I support more housing but the density seems too high. 45 dwellings per hectare feels urban, not rural." },
  { name: 'Andrew Martin', email: 'andrew.m@example.com', feedback: "What are the proposed construction hours? I work night shifts and need to sleep during the day." },
  { name: 'Helen Wright', email: 'helen.w@example.com', feedback: "The affordable housing provision of 35% is excellent. Finally young people might be able to stay in the village." },
  { name: 'Thomas Scott', email: 'thomas.s@example.com', feedback: "I'm concerned about construction traffic on narrow lanes. HGVs will damage verges and make walking to school dangerous." },
  { name: 'Rachel King', email: 'rachel.k@example.com', feedback: "Will there be any community facilities included? A small cafe or community room would be wonderful." },
]

// GET to list projects (for finding the right one)
export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ projects })
}

// POST to add test data - accepts ?name=project-name&type=pins|forms|all query params
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectName = searchParams.get('name')
  const type = searchParams.get('type') || 'all' // pins, forms, or all

  if (!projectName) {
    return NextResponse.json({ error: 'Missing ?name= query parameter' }, { status: 400 })
  }

  // Find project by name (case insensitive partial match)
  const project = await prisma.project.findFirst({
    where: {
      name: { contains: projectName, mode: 'insensitive' },
    },
    include: {
      feedbackForms: true,
    },
  })

  if (!project) {
    return NextResponse.json({ error: `Project not found matching "${projectName}"` }, { status: 404 })
  }

  const baseLat = project.latitude || 51.5
  const baseLng = project.longitude || -0.1

  let pinsCreated = 0
  let formsCreated = 0

  // Add map pins
  if (type === 'pins' || type === 'all') {
    for (let i = 0; i < testFeedback.length; i++) {
      const feedback = testFeedback[i]
      const lat = baseLat + (Math.random() - 0.5) * 0.01
      const lng = baseLng + (Math.random() - 0.5) * 0.01

      await prisma.publicPin.create({
        data: {
          projectId: project.id,
          latitude: lat,
          longitude: lng,
          category: feedback.category,
          comment: feedback.comment,
          name: `Test Resident ${i + 1}`,
          email: `test${i + 1}@example.com`,
          approved: true,
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
      })
      pinsCreated++
    }
  }

  // Add form submissions
  if (type === 'forms' || type === 'all') {
    // Find or create a feedback form for this project
    let form = project.feedbackForms[0]

    if (!form) {
      form = await prisma.feedbackForm.create({
        data: {
          projectId: project.id,
          name: 'General Feedback',
          fields: [
            { id: 'name', type: 'text', label: 'Your Name', required: true },
            { id: 'email', type: 'email', label: 'Email Address', required: true },
            { id: 'feedback', type: 'textarea', label: 'Your Feedback', required: true },
          ],
          active: true,
        },
      })
    }

    for (const submission of testFormSubmissions) {
      await prisma.feedbackResponse.create({
        data: {
          formId: form.id,
          data: {
            name: submission.name,
            email: submission.email,
            feedback: submission.feedback,
          },
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
      })
      formsCreated++
    }
  }

  return NextResponse.json({
    success: true,
    project: project.name,
    projectId: project.id,
    message: `Added ${pinsCreated} map pins and ${formsCreated} form submissions`,
  })
}

// DELETE to remove test data - accepts ?name=project-name query param
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectName = searchParams.get('name')

  if (!projectName) {
    return NextResponse.json({ error: 'Missing ?name= query parameter' }, { status: 400 })
  }

  const project = await prisma.project.findFirst({
    where: {
      name: { contains: projectName, mode: 'insensitive' },
    },
    include: {
      feedbackForms: true,
    },
  })

  if (!project) {
    return NextResponse.json({ error: `Project not found matching "${projectName}"` }, { status: 404 })
  }

  // Delete test pins
  const deletedPins = await prisma.publicPin.deleteMany({
    where: {
      projectId: project.id,
      email: { contains: '@example.com' },
    },
  })

  // Delete test form submissions
  let deletedForms = 0
  for (const form of project.feedbackForms) {
    const result = await prisma.feedbackResponse.deleteMany({
      where: {
        formId: form.id,
        data: {
          path: ['email'],
          string_contains: '@example.com',
        },
      },
    })
    deletedForms += result.count
  }

  return NextResponse.json({
    success: true,
    project: project.name,
    message: `Deleted ${deletedPins.count} pins and ${deletedForms} form submissions`,
  })
}
