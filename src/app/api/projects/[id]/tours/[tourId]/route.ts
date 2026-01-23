import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Get a single tour with its stops
export async function GET(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  const tour = await prisma.tour.findUnique({
    where: { id: params.tourId },
    include: {
      stops: {
        orderBy: { order: 'asc' }
      }
    }
  })

  if (!tour) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  if (tour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found in this project' }, { status: 404 })
  }

  return NextResponse.json(tour)
}

// PATCH - Update a tour
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  const body = await request.json()

  // Verify tour belongs to project
  const existingTour = await prisma.tour.findUnique({
    where: { id: params.tourId }
  })

  if (!existingTour || existingTour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  const tour = await prisma.tour.update({
    where: { id: params.tourId },
    data: {
      name: body.name,
      description: body.description,
      active: body.active,
    },
    include: {
      stops: {
        orderBy: { order: 'asc' }
      }
    }
  })

  return NextResponse.json(tour)
}

// DELETE - Delete a tour
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; tourId: string } }
) {
  // Verify tour belongs to project
  const existingTour = await prisma.tour.findUnique({
    where: { id: params.tourId }
  })

  if (!existingTour || existingTour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  await prisma.tour.delete({
    where: { id: params.tourId }
  })

  return NextResponse.json({ success: true })
}
