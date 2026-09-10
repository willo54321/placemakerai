import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { parseStopPayload } from '@/lib/tours'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

async function findStop(projectId: string, tourId: string, stopId: string) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: stopId },
    include: { tour: { select: { projectId: true } } }
  })
  if (!stop || stop.tourId !== tourId || stop.tour.projectId !== projectId) return null
  return stop
}

// PATCH - Update a stop (partial: only provided fields change)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; tourId: string; stopId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await findStop(params.id, params.tourId, params.stopId)
  if (!existing) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }

  const body = await request.json()
  const { errors, data } = parseStopPayload(body, true)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const stop = await prisma.tourStop.update({
    where: { id: params.stopId },
    data: data as Prisma.TourStopUncheckedUpdateInput,
  })

  return NextResponse.json(stop)
}

// DELETE - Remove a stop and close the numbering gap
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; tourId: string; stopId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await findStop(params.id, params.tourId, params.stopId)
  if (!existing) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }

  await prisma.$transaction(async tx => {
    await tx.tourStop.delete({ where: { id: params.stopId } })
    const remaining = await tx.tourStop.findMany({
      where: { tourId: params.tourId },
      orderBy: { order: 'asc' },
      select: { id: true, order: true }
    })
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].order !== i) {
        await tx.tourStop.update({ where: { id: remaining[i].id }, data: { order: i } })
      }
    }
  })

  return NextResponse.json({ success: true })
}
