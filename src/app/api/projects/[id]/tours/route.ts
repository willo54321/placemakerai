import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List all tours for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const tours = await prisma.tour.findMany({
    where: { projectId: params.id },
    include: {
      stops: {
        orderBy: { order: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json(tours)
}

// POST - Create a new tour
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const tour = await prisma.tour.create({
    data: {
      projectId: params.id,
      name: body.name,
      description: body.description || null,
      active: body.active ?? true,
    },
    include: {
      stops: true
    }
  })

  return NextResponse.json(tour)
}
