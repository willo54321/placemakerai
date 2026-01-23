import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Get a single stop
export async function GET(
  request: Request,
  { params }: { params: { id: string; tourId: string; stopId: string } }
) {
  const stop = await prisma.tourStop.findUnique({
    where: { id: params.stopId }
  })

  if (!stop || stop.tourId !== params.tourId) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }

  return NextResponse.json(stop)
}

// PATCH - Update a stop
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; tourId: string; stopId: string } }
) {
  const body = await request.json()

  // Verify stop belongs to tour
  const existingStop = await prisma.tourStop.findUnique({
    where: { id: params.stopId }
  })

  if (!existingStop || existingStop.tourId !== params.tourId) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }

  const stop = await prisma.tourStop.update({
    where: { id: params.stopId },
    data: {
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      latitude: body.latitude,
      longitude: body.longitude,
      zoom: body.zoom,
      highlight: body.highlight,
      showOverlay: body.showOverlay,
    }
  })

  return NextResponse.json(stop)
}

// DELETE - Delete a stop
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; tourId: string; stopId: string } }
) {
  // Verify stop belongs to tour
  const existingStop = await prisma.tourStop.findUnique({
    where: { id: params.stopId }
  })

  if (!existingStop || existingStop.tourId !== params.tourId) {
    return NextResponse.json({ error: 'Stop not found' }, { status: 404 })
  }

  await prisma.tourStop.delete({
    where: { id: params.stopId }
  })

  // Reorder remaining stops
  const remainingStops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    orderBy: { order: 'asc' }
  })

  for (let i = 0; i < remainingStops.length; i++) {
    if (remainingStops[i].order !== i) {
      await prisma.tourStop.update({
        where: { id: remainingStops[i].id },
        data: { order: i }
      })
    }
  }

  return NextResponse.json({ success: true })
}
