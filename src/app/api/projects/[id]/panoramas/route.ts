import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List all panoramas for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const panoramas = await prisma.panorama.findMany({
    where: { projectId: params.id },
    include: {
      hotspots: true
    },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(panoramas)
}

// POST - Create a new panorama
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Get the highest order number
  const lastPanorama = await prisma.panorama.findFirst({
    where: { projectId: params.id },
    orderBy: { order: 'desc' }
  })
  const nextOrder = (lastPanorama?.order ?? -1) + 1

  const panorama = await prisma.panorama.create({
    data: {
      projectId: params.id,
      name: body.name,
      description: body.description || null,
      imageUrl: body.imageUrl,
      initialYaw: body.initialYaw ?? 0,
      initialPitch: body.initialPitch ?? 0,
      initialFov: body.initialFov ?? 100,
      order: body.order ?? nextOrder,
      active: body.active ?? true,
    },
    include: {
      hotspots: true
    }
  })

  return NextResponse.json(panorama)
}
