import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET all campaigns for a project (drafts + send history)
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const campaigns = await prisma.campaign.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(campaigns)
}

// POST - create a draft campaign
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.body === 'string' ? body.body.trim() : ''

  if (!subject || !message) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }
  if (subject.length > 200 || message.length > 20000) {
    return NextResponse.json({ error: 'subject or body too long' }, { status: 400 })
  }

  const campaign = await prisma.campaign.create({
    data: {
      projectId: params.id,
      subject,
      body: message,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'campaign.create',
    targetType: 'Campaign',
    targetId: campaign.id,
    detail: { subject },
  })

  return NextResponse.json(campaign)
}
