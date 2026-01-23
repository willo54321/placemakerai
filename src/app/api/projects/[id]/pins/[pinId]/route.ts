import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Update pin (approve/reject)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  const body = await request.json()

  // Verify the pin belongs to this project
  const pin = await prisma.publicPin.findFirst({
    where: {
      id: params.pinId,
      projectId: params.id
    }
  })

  if (!pin) {
    return NextResponse.json({ error: 'Pin not found' }, { status: 404 })
  }

  const updatedPin = await prisma.publicPin.update({
    where: { id: params.pinId },
    data: {
      approved: body.approved
    }
  })

  return NextResponse.json(updatedPin)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  // Verify the pin belongs to this project
  const pin = await prisma.publicPin.findFirst({
    where: {
      id: params.pinId,
      projectId: params.id
    }
  })

  if (!pin) {
    return NextResponse.json({ error: 'Pin not found' }, { status: 404 })
  }

  await prisma.publicPin.delete({
    where: { id: params.pinId }
  })

  return NextResponse.json({ success: true })
}
