import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// Verify the engagement belongs to the given stakeholder, and that the
// stakeholder belongs to the given project. Returns true when the whole chain
// matches — guards against cross-project/cross-stakeholder tampering via the URL.
async function engagementInProject(
  engagementId: string,
  stakeholderId: string,
  projectId: string
) {
  const engagement = await prisma.stakeholderEngagement.findFirst({
    where: { id: engagementId, stakeholderId, stakeholder: { projectId } },
    select: { id: true },
  })
  return !!engagement
}

const ENGAGEMENT_UPDATABLE_FIELDS = [
  'type', 'title', 'description', 'outcome', 'nextAction',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string; engagementId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  if (!(await engagementInProject(params.engagementId, params.stakeholderId, params.id))) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  for (const field of ENGAGEMENT_UPDATABLE_FIELDS) {
    if (field in body) data[field] = body[field]
  }
  if (body.date !== undefined) data.date = body.date ? new Date(body.date) : undefined

  const engagement = await prisma.stakeholderEngagement.update({
    where: { id: params.engagementId },
    data,
  })

  return NextResponse.json(engagement)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string; engagementId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  if (!(await engagementInProject(params.engagementId, params.stakeholderId, params.id))) {
    return NextResponse.json({ error: 'Engagement not found' }, { status: 404 })
  }

  await prisma.stakeholderEngagement.delete({ where: { id: params.engagementId } })

  await logAudit({
    projectId: params.id,
    action: 'engagement.delete',
    targetType: 'stakeholderEngagement',
    targetId: params.engagementId,
  })

  return NextResponse.json({ success: true })
}
