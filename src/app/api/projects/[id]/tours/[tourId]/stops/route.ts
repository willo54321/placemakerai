import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { withApiHandler } from '@/lib/api-error'
import { parseStopPayload } from '@/lib/tours'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

// POST - Add a stop to a tour (appended at the end)
export const POST = withApiHandler(async (
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) => {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const tour = await prisma.tour.findUnique({ where: { id: params.tourId } })
  if (!tour || tour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  const body = await request.json()
  const { errors, data } = parseStopPayload(body, false)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const lastStop = await prisma.tourStop.findFirst({
    where: { tourId: params.tourId },
    orderBy: { order: 'desc' }
  })

  const stop = await prisma.tourStop.create({
    data: {
      ...(data as Prisma.TourStopUncheckedCreateInput),
      tourId: params.tourId,
      order: (lastStop?.order ?? -1) + 1,
    }
  })

  return NextResponse.json(stop)
})
