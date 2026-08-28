import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// POST - Reorder stops
export async function POST(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Verify tour belongs to project
  const tour = await prisma.tour.findUnique({
    where: { id: params.tourId }
  })

  if (!tour || tour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  // body.stops should be an array of stop IDs in the new order
  const stopIds: string[] = body.stops

  // Validate that every stop id belongs to this tour before writing
  const tourStops = await prisma.tourStop.findMany({
    where: {
      id: { in: stopIds },
      tourId: params.tourId
    },
    select: { id: true }
  })

  if (tourStops.length !== stopIds.length) {
    return NextResponse.json({ error: 'Some stops do not belong to this tour' }, { status: 400 })
  }

  // Update each stop's order (wrapped in a transaction so a partial
  // failure can't half-reorder)
  const updates = stopIds.map((stopId, index) =>
    prisma.tourStop.update({
      where: { id: stopId },
      data: { order: index }
    })
  )

  await prisma.$transaction(updates)

  // Return updated stops
  const stops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(stops)
}
