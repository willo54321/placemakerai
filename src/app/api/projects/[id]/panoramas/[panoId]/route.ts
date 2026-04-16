import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Get a single panorama with its hotspots
export async function GET(
  request: Request,
  { params }: { params: { id: string; panoId: string } }
) {
  const panorama = await prisma.panorama.findUnique({
    where: { id: params.panoId },
    include: {
      hotspots: true
    }
  })

  if (!panorama) {
    return NextResponse.json({ error: 'Panorama not found' }, { status: 404 })
  }

  if (panorama.projectId !== params.id) {
    return NextResponse.json({ error: 'Panorama not found in this project' }, { status: 404 })
  }

  return NextResponse.json(panorama)
}

// PATCH - Update a panorama
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; panoId: string } }
) {
  const body = await request.json()

  // Verify panorama belongs to project
  const existingPanorama = await prisma.panorama.findUnique({
    where: { id: params.panoId }
  })

  if (!existingPanorama || existingPanorama.projectId !== params.id) {
    return NextResponse.json({ error: 'Panorama not found' }, { status: 404 })
  }

  const panorama = await prisma.panorama.update({
    where: { id: params.panoId },
    data: {
      name: body.name,
      description: body.description,
      imageUrl: body.imageUrl,
      initialYaw: body.initialYaw,
      initialPitch: body.initialPitch,
      initialFov: body.initialFov,
      order: body.order,
      active: body.active,
    },
    include: {
      hotspots: true
    }
  })

  return NextResponse.json(panorama)
}

// DELETE - Delete a panorama
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; panoId: string } }
) {
  // Verify panorama belongs to project
  const existingPanorama = await prisma.panorama.findUnique({
    where: { id: params.panoId }
  })

  if (!existingPanorama || existingPanorama.projectId !== params.id) {
    return NextResponse.json({ error: 'Panorama not found' }, { status: 404 })
  }

  await prisma.panorama.delete({
    where: { id: params.panoId }
  })

  // Reorder remaining panoramas
  const remainingPanoramas = await prisma.panorama.findMany({
    where: { projectId: params.id },
    orderBy: { order: 'asc' }
  })

  for (let i = 0; i < remainingPanoramas.length; i++) {
    if (remainingPanoramas[i].order !== i) {
      await prisma.panorama.update({
        where: { id: remainingPanoramas[i].id },
        data: { order: i }
      })
    }
  }

  return NextResponse.json({ success: true })
}
