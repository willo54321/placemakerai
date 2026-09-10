import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// POST - Reorder stops. Body: { stops: [stopId, ...] } in the new order.
export async function POST(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const tour = await prisma.tour.findUnique({ where: { id: params.tourId } })
  if (!tour || tour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  const body = await request.json()
  const stopIds: unknown = body.stops
  if (!Array.isArray(stopIds) || stopIds.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'stops must be an array of stop ids' }, { status: 400 })
  }

  const tourStops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    select: { id: true }
  })

  // The new order must be a permutation of the tour's current stops.
  const currentIds = new Set(tourStops.map(s => s.id))
  if (stopIds.length !== currentIds.size || stopIds.some(id => !currentIds.has(id as string))) {
    return NextResponse.json({ error: 'stops must include every stop of this tour exactly once' }, { status: 400 })
  }

  await prisma.$transaction(
    (stopIds as string[]).map((stopId, index) =>
      prisma.tourStop.update({ where: { id: stopId }, data: { order: index } })
    )
  )

  const stops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(stops)
}
