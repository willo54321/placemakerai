import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const stakeholder = await prisma.stakeholder.findUnique({
    where: { id: params.stakeholderId },
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const body = await request.json()
  const stakeholder = await prisma.stakeholder.update({
    where: { id: params.stakeholderId },
    data: body,
  })
  return NextResponse.json(stakeholder)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  await prisma.stakeholder.delete({
    where: { id: params.stakeholderId },
  })
  return NextResponse.json({ success: true })
}
