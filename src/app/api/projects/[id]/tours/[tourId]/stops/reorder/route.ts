import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST - Reorder stops
export async function POST(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
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

  // Update each stop's order
  await Promise.all(
    stopIds.map((stopId, index) =>
      prisma.tourStop.update({
        where: { id: stopId },
        data: { order: index }
      })
    )
  )

  // Return updated stops
  const stops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(stops)
}
