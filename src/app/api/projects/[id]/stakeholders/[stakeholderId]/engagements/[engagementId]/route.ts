import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

// Verify the engagement belongs to the given stakeholder, and that the
// stakeholder belongs to the given project. Returns true when the whole
// chain matches.
async function engagementInProject(
  engagementId: string,
  stakeholderId: string,
  projectId: string
) {
  const engagement = await prisma.stakeholderEngagement.findFirst({
    where: {
      id: engagementId,
      stakeholderId,
      stakeholder: { projectId },
    },
    select: { id: true },
  })
  return !!engagement
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string; engagementId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  if (
    !(await engagementInProject(
      params.engagementId,
      params.stakeholderId,
      params.id
    ))
  ) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

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
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  if (
    !(await engagementInProject(
      params.engagementId,
      params.stakeholderId,
      params.id
    ))
  ) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  await prisma.stakeholderEngagement.delete({
    where: { id: params.engagementId },
  })

  return NextResponse.json({ success: true })
}
