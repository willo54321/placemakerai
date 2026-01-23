import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()

    // Check if image is too large (over 5MB base64)
    if (body.imageUrl && body.imageUrl.length > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image too large. Please use an image under 5MB.' },
        { status: 400 }
      )
    }

    const overlay = await prisma.imageOverlay.create({
      data: {
        projectId: params.id,
        name: body.name,
        imageUrl: body.imageUrl,
        southLat: body.bounds[0][0],
        westLng: body.bounds[0][1],
        northLat: body.bounds[1][0],
        eastLng: body.bounds[1][1],
        opacity: body.opacity ?? 0.7,
        visible: body.visible ?? true,
      }
    })

    return NextResponse.json({
      id: overlay.id,
      tempId: body.tempId, // Return tempId so frontend can update local state
      name: overlay.name,
      imageUrl: overlay.imageUrl,
      bounds: [[overlay.southLat, overlay.westLng], [overlay.northLat, overlay.eastLng]],
      opacity: overlay.opacity,
      visible: overlay.visible,
    })
  } catch (error) {
    console.error('Error creating overlay:', error)
    return NextResponse.json(
      { error: 'Failed to create overlay. The image may be too large.' },
      { status: 500 }
    )
  }
}
