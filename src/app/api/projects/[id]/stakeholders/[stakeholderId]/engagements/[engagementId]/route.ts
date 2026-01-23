import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string; engagementId: string } }
) {
  const body = await request.json()

  const engagement = await prisma.stakeholderEngagement.update({
    where: { id: params.engagementId },
    data: {
      type: body.type,
      title: body.title,
      description: body.description,
      date: body.date ? new Date(body.date) : undefined,
      outcome: body.outcome,
      nextAction: body.nextAction,
    },
  })

  return NextResponse.json(engagement)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string; engagementId: string } }
) {
  await prisma.stakeholderEngagement.delete({
    where: { id: params.engagementId },
  })

  return NextResponse.json({ success: true })
}
