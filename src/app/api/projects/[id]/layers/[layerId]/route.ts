import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// PATCH update a geo layer
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; layerId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Verify the layer belongs to this project
  const existing = await prisma.geoLayer.findFirst({
    where: { id: params.layerId, projectId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Layer not found' }, { status: 404 })
  }

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
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  await prisma.geoLayer.deleteMany({
    where: { id: params.layerId, projectId: params.id }
  })

  return NextResponse.json({ success: true })
}
