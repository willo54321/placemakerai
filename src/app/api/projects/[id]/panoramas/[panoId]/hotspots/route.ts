import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - List all hotspots for a panorama
export async function GET(
  request: Request,
  { params }: { params: { id: string; panoId: string } }
) {
  const hotspots = await prisma.panoramaHotspot.findMany({
    where: { panoramaId: params.panoId }
  })

  return NextResponse.json(hotspots)
}

// POST - Add a new hotspot to a panorama
export async function POST(
  request: Request,
  { params }: { params: { id: string; panoId: string } }
) {
  const body = await request.json()

  // Verify panorama belongs to project
  const panorama = await prisma.panorama.findUnique({
    where: { id: params.panoId }
  })

  if (!panorama || panorama.projectId !== params.id) {
    return NextResponse.json({ error: 'Panorama not found' }, { status: 404 })
  }

  const hotspot = await prisma.panoramaHotspot.create({
    data: {
      panoramaId: params.panoId,
      type: body.type || 'info',
      yaw: body.yaw,
      pitch: body.pitch,
      title: body.title || null,
      content: body.content || null,
      icon: body.icon || null,
      targetId: body.targetId || null,
      videoUrl: body.videoUrl || null,
      imageUrl: body.imageUrl || null,
    }
  })

  return NextResponse.json(hotspot)
}
