import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET - The project's stakeholder register. Read access (CLIENT) is enough.
// Returns each stakeholder with an engagement count and the date of the most
// recent engagement, so the register table can show activity without loading
// every timeline.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const stakeholders = await prisma.stakeholder.findMany({
    where: { projectId: params.id },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { engagements: true } },
      engagements: { orderBy: { date: 'desc' }, take: 1, select: { date: true } },
    },
  })

  const rows = stakeholders.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    phone: s.phone,
    organization: s.organization,
    role: s.role,
    category: s.category,
    type: s.type,
    influence: s.influence,
    interest: s.interest,
    latitude: s.latitude,
    longitude: s.longitude,
    engagementCount: s._count.engagements,
    lastEngagedAt: s.engagements[0]?.date ?? null,
    createdAt: s.createdAt,
  }))

  return NextResponse.json({ stakeholders: rows })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const stakeholder = await prisma.stakeholder.create({
    data: {
      projectId: params.id,
      name: body.name.trim(),
      email: body.email || null,
      phone: body.phone || null,
      organization: body.organization || null,
      role: body.role || null,
      category: body.category || 'neutral',
      type: body.type || 'other',
      notes: body.notes || null,
      influence: typeof body.influence === 'number' ? body.influence : null,
      interest: typeof body.interest === 'number' ? body.interest : null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'stakeholder.create',
    targetType: 'stakeholder',
    targetId: stakeholder.id,
    detail: { name: stakeholder.name },
  })

  return NextResponse.json(stakeholder)
}
