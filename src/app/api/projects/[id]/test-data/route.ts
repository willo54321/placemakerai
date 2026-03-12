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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  // Check project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const baseLat = project.latitude || 51.5
  const baseLng = project.longitude || -0.1

  const created = []

  for (let i = 0; i < testFeedback.length; i++) {
    const feedback = testFeedback[i]

    // Spread pins around the project location
    const lat = baseLat + (Math.random() - 0.5) * 0.01
    const lng = baseLng + (Math.random() - 0.5) * 0.01

    const pin = await prisma.publicPin.create({
      data: {
        projectId,
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

    created.push(pin.id)
  }

  return NextResponse.json({
    success: true,
    message: `Added ${created.length} test feedback items`,
    ids: created,
  })
}

// DELETE to remove test data
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  const deleted = await prisma.publicPin.deleteMany({
    where: {
      projectId,
      email: { contains: '@example.com' },
    },
  })

  return NextResponse.json({
    success: true,
    message: `Deleted ${deleted.count} test feedback items`,
  })
}
