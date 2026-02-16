import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; overlayId: string } }
) {
  const body = await request.json()

  // Build update data dynamically based on what's provided
  const updateData: any = {}

  if (body.name !== undefined) updateData.name = body.name
  if (body.opacity !== undefined) updateData.opacity = body.opacity
  if (body.rotation !== undefined) updateData.rotation = body.rotation
  if (body.visible !== undefined) updateData.visible = body.visible
  if (body.bounds !== undefined) {
    updateData.southLat = body.bounds[0][0]
    updateData.westLng = body.bounds[0][1]
    updateData.northLat = body.bounds[1][0]
    updateData.eastLng = body.bounds[1][1]
  }

  const overlay = await prisma.imageOverlay.update({
    where: {
      id: params.overlayId,
      projectId: params.id
    },
    data: updateData,
  })

  return NextResponse.json({
    id: overlay.id,
    name: overlay.name,
    imageUrl: overlay.imageUrl,
    bounds: [[overlay.southLat, overlay.westLng], [overlay.northLat, overlay.eastLng]],
    opacity: overlay.opacity,
    rotation: overlay.rotation,
    visible: overlay.visible,
  })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; overlayId: string } }
) {
  await prisma.imageOverlay.delete({
    where: {
      id: params.overlayId,
      projectId: params.id
    },
  })

  return NextResponse.json({ success: true })
}
