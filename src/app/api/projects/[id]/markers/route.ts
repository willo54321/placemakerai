import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const markers = await prisma.mapMarker.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(markers)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Support both point markers and geometry-based shapes (polygon/line)
  const marker = await prisma.mapMarker.create({
    data: {
      projectId: params.id,
      label: body.label,
      type: body.type || 'point',
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      geometry: body.geometry || null,
      color: body.color || '#3B82F6',
      notes: body.notes || null,
    },
  })
  return NextResponse.json(marker)
}
