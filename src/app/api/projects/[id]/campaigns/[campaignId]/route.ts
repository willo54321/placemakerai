import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// PATCH - edit a draft. Sent campaigns are the immutable send record, so only
// drafts (and failed sends being retried) can change.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; campaignId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.campaignId, projectId: params.id },
  })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Sent campaigns cannot be edited' }, { status: 400 })
  }

  const body = await request.json()
  const data: { subject?: string; body?: string } = {}
  if (typeof body.subject === 'string' && body.subject.trim()) data.subject = body.subject.trim().slice(0, 200)
  if (typeof body.body === 'string' && body.body.trim()) data.body = body.body.trim().slice(0, 20000)

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data,
  })
  return NextResponse.json(updated)
}

// DELETE - remove a draft. Sent campaigns stay: they are the record of what
// went out.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; campaignId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const campaign = await prisma.campaign.findFirst({
    where: { id: params.campaignId, projectId: params.id },
  })
  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Sent campaigns cannot be deleted' }, { status: 400 })
  }

  await prisma.campaign.delete({ where: { id: campaign.id } })

  await logAudit({
    projectId: params.id,
    action: 'campaign.delete',
    targetType: 'Campaign',
    targetId: campaign.id,
    detail: { subject: campaign.subject },
  })

  return NextResponse.json({ success: true })
}
