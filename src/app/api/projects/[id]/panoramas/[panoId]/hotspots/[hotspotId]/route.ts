import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET - Get a single hotspot
export async function GET(
  request: Request,
  { params }: { params: { id: string; panoId: string; hotspotId: string } }
) {
  const hotspot = await prisma.panoramaHotspot.findUnique({
    where: { id: params.hotspotId }
  })

  if (!hotspot || hotspot.panoramaId !== params.panoId) {
    return NextResponse.json({ error: 'Hotspot not found' }, { status: 404 })
  }

  return NextResponse.json(hotspot)
}

// PATCH - Update a hotspot
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; panoId: string; hotspotId: string } }
) {
  const body = await request.json()

  // Verify hotspot belongs to panorama
  const existingHotspot = await prisma.panoramaHotspot.findUnique({
    where: { id: params.hotspotId }
  })

  if (!existingHotspot || existingHotspot.panoramaId !== params.panoId) {
    return NextResponse.json({ error: 'Hotspot not found' }, { status: 404 })
  }

  const hotspot = await prisma.panoramaHotspot.update({
    where: { id: params.hotspotId },
    data: {
      type: body.type,
      yaw: body.yaw,
      pitch: body.pitch,
      title: body.title,
      content: body.content,
      icon: body.icon,
      targetId: body.targetId,
      videoUrl: body.videoUrl,
      imageUrl: body.imageUrl,
    }
  })

  return NextResponse.json(hotspot)
}

// DELETE - Delete a hotspot
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; panoId: string; hotspotId: string } }
) {
  // Verify hotspot belongs to panorama
  const existingHotspot = await prisma.panoramaHotspot.findUnique({
    where: { id: params.hotspotId }
  })

  if (!existingHotspot || existingHotspot.panoramaId !== params.panoId) {
    return NextResponse.json({ error: 'Hotspot not found' }, { status: 404 })
  }

  await prisma.panoramaHotspot.delete({
    where: { id: params.hotspotId }
  })

  return NextResponse.json({ success: true })
}
