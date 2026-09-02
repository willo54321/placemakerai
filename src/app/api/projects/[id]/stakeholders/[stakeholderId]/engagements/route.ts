import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// Verify the stakeholder belongs to this project. Returns true when it does.
async function stakeholderBelongsToProject(stakeholderId: string, projectId: string) {
  const stakeholder = await prisma.stakeholder.findFirst({
    where: { id: stakeholderId, projectId },
    select: { id: true },
  })
  return !!stakeholder
}

export async function GET(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  if (!(await stakeholderBelongsToProject(params.stakeholderId, params.id))) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  const engagements = await prisma.stakeholderEngagement.findMany({
    where: { stakeholderId: params.stakeholderId },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(engagements)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  if (!(await stakeholderBelongsToProject(params.stakeholderId, params.id))) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  const body = await request.json()
  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const engagement = await prisma.stakeholderEngagement.create({
    data: {
      stakeholderId: params.stakeholderId,
      type: body.type || 'other',
      title: body.title.trim(),
      description: body.description || null,
      date: body.date ? new Date(body.date) : new Date(),
      outcome: body.outcome || null,
      nextAction: body.nextAction || null,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'engagement.create',
    targetType: 'stakeholderEngagement',
    targetId: engagement.id,
    detail: { stakeholderId: params.stakeholderId, type: engagement.type },
  })

  return NextResponse.json(engagement)
}
