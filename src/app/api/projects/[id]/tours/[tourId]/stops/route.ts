import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List all stops for a tour
export async function GET(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  const stops = await prisma.tourStop.findMany({
    where: { tourId: params.tourId },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(stops)
}

// POST - Add a new stop to a tour
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

  // Get the highest order number
  const lastStop = await prisma.tourStop.findFirst({
    where: { tourId: params.tourId },
    orderBy: { order: 'desc' }
  })
  const nextOrder = (lastStop?.order ?? -1) + 1

  const stop = await prisma.tourStop.create({
    data: {
      tourId: params.tourId,
      order: body.order ?? nextOrder,
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl || null,
      latitude: body.latitude,
      longitude: body.longitude,
      zoom: body.zoom ?? 16,
      highlight: body.highlight || null,
      showOverlay: body.showOverlay || null,
      icon: body.icon || null,
    }
  })

  return NextResponse.json(stop)
}
