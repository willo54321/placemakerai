import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET - A single stakeholder with its engagement timeline, plus any public
// enquiries submitted from the same email address (the cross-link into the
// enquiry desk). Read access (CLIENT) is enough.
export async function GET(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const stakeholder = await prisma.stakeholder.findFirst({
    where: { id: params.stakeholderId, projectId: params.id },
    include: { engagements: { orderBy: { date: 'desc' } } },
  })

  if (!stakeholder) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  // Cross-link: public enquiries from this stakeholder's email address.
  let relatedEnquiries: Array<{ id: string; subject: string; status: string; createdAt: Date }> = []
  if (stakeholder.email) {
    relatedEnquiries = await prisma.enquiry.findMany({
      where: { projectId: params.id, submitterEmail: stakeholder.email },
      select: { id: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  return NextResponse.json({ ...stakeholder, relatedEnquiries })
}

// Fields a client may update. Any other keys (projectId, id, createdAt) are
// ignored to prevent mass-assignment.
const STAKEHOLDER_UPDATABLE_FIELDS = [
  'name', 'email', 'phone', 'organization', 'role', 'category', 'notes',
  'latitude', 'longitude', 'influence', 'interest', 'type',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await prisma.stakeholder.findFirst({
    where: { id: params.stakeholderId, projectId: params.id },
    select: { id: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  const body = await request.json()
  const data: Record<string, unknown> = {}
  for (const field of STAKEHOLDER_UPDATABLE_FIELDS) {
    if (field in body) data[field] = body[field]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
  }

  const stakeholder = await prisma.stakeholder.update({
    where: { id: params.stakeholderId },
    data,
  })

  await logAudit({
    projectId: params.id,
    action: 'stakeholder.update',
    targetType: 'stakeholder',
    targetId: stakeholder.id,
    detail: { fields: Object.keys(data) },
  })

  return NextResponse.json(stakeholder)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  // Scope the delete to this project so a stakeholder from another project
  // cannot be deleted via a mismatched projectId in the URL.
  const { count } = await prisma.stakeholder.deleteMany({
    where: { id: params.stakeholderId, projectId: params.id },
  })

  if (count === 0) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  await logAudit({
    projectId: params.id,
    action: 'stakeholder.delete',
    targetType: 'stakeholder',
    targetId: params.stakeholderId,
  })

  return NextResponse.json({ success: true })
}
