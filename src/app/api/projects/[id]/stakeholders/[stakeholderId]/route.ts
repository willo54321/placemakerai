import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const stakeholder = await prisma.stakeholder.findFirst({
    where: { id: params.stakeholderId, projectId: params.id },
    include: {
      engagements: {
        orderBy: { date: 'desc' },
      },
    },
  })

  if (!stakeholder) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  // Also fetch related enquiries by email if the stakeholder has one
  let relatedEnquiries: Array<{id: string; subject: string; status: string; createdAt: Date}> = []
  if (stakeholder.email) {
    relatedEnquiries = await prisma.enquiry.findMany({
      where: {
        projectId: params.id,
        submitterEmail: stakeholder.email,
      },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  return NextResponse.json({ ...stakeholder, relatedEnquiries })
}

// Fields a client is allowed to update on a stakeholder. Any other keys in the
// request body (e.g. projectId, id, createdAt) are ignored to prevent
// mass-assignment.
const STAKEHOLDER_UPDATABLE_FIELDS = [
  'name',
  'email',
  'phone',
  'organization',
  'role',
  'category',
  'notes',
  'latitude',
  'longitude',
  'influence',
  'interest',
  'type',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Verify the stakeholder belongs to this project before mutating.
  const existing = await prisma.stakeholder.findFirst({
    where: { id: params.stakeholderId, projectId: params.id },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: 'Stakeholder not found' }, { status: 404 })
  }

  // Whitelist allowed fields only to prevent mass-assignment.
  const data: Record<string, unknown> = {}
  for (const field of STAKEHOLDER_UPDATABLE_FIELDS) {
    if (field in body) {
      data[field] = body[field]
    }
  }

  const stakeholder = await prisma.stakeholder.update({
    where: { id: params.stakeholderId },
    data,
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

  return NextResponse.json({ success: true })
}
