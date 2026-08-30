import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// Update pin (approve/reject)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

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

  // Build update data
  const updateData: { approved?: boolean } = {}

  // Handle approval toggle
  if (typeof body.approved === 'boolean') {
    updateData.approved = body.approved
  }

  const updatedPin = await prisma.publicPin.update({
    where: { id: params.pinId },
    data: updateData
  })

  if (typeof updateData.approved === 'boolean') {
    await logAudit({
      projectId: params.id,
      action: updateData.approved ? 'pin.approve' : 'pin.unapprove',
      targetType: 'PublicPin',
      targetId: params.pinId,
    })
  }

  return NextResponse.json(updatedPin)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

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

  await logAudit({
    projectId: params.id,
    action: 'pin.delete',
    targetType: 'PublicPin',
    targetId: params.pinId,
    detail: { approved: pin.approved, category: pin.category },
  })

  return NextResponse.json({ success: true })
}
