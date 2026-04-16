import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST - Reorder panoramas
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { panoramaIds } = body as { panoramaIds: string[] }

  if (!Array.isArray(panoramaIds)) {
    return NextResponse.json({ error: 'panoramaIds must be an array' }, { status: 400 })
  }

  // Verify all panoramas belong to this project
  const panoramas = await prisma.panorama.findMany({
    where: {
      id: { in: panoramaIds },
      projectId: params.id
    }
  })

  if (panoramas.length !== panoramaIds.length) {
    return NextResponse.json({ error: 'Some panoramas not found in this project' }, { status: 400 })
  }

  // Update order for each panorama
  await Promise.all(
    panoramaIds.map((id, index) =>
      prisma.panorama.update({
        where: { id },
        data: { order: index }
      })
    )
  )

  // Return updated panoramas
  const updatedPanoramas = await prisma.panorama.findMany({
    where: { projectId: params.id },
    include: { hotspots: true },
    orderBy: { order: 'asc' }
  })

  return NextResponse.json(updatedPanoramas)
}
