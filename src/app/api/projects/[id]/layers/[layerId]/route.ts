import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// PATCH update a geo layer
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; layerId: string } }
) {
  const body = await request.json()

  const layer = await prisma.geoLayer.update({
    where: { id: params.layerId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.style !== undefined && { style: body.style }),
      ...(body.visible !== undefined && { visible: body.visible }),
      ...(body.geojson !== undefined && { geojson: body.geojson })
    }
  })

  return NextResponse.json({
    id: layer.id,
    name: layer.name,
    type: layer.type,
    geojson: layer.geojson,
    style: layer.style,
    visible: layer.visible,
    createdAt: layer.createdAt
  })
}

// DELETE a geo layer
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; layerId: string } }
) {
  await prisma.geoLayer.delete({
    where: { id: params.layerId }
  })

  return NextResponse.json({ success: true })
}
