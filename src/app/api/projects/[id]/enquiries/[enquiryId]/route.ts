import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const enquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    include: {
      assignedTo: true,
      messages: { orderBy: { createdAt: 'asc' } },
      queries: {
        include: { teamMember: true },
        orderBy: { sentAt: 'desc' },
      },
    },
  })
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }
  return NextResponse.json(enquiry)
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Get the current enquiry to check if this is a new response being sent
  // and to verify it belongs to this project before mutating.
  const currentEnquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    select: { sentAt: true, submitterEmail: true, subject: true },
  })

  if (!currentEnquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const enquiry = await prisma.enquiry.update({
    where: { id: params.enquiryId },
    data: {
      status: body.status,
      assignedToId: body.assignedToId,
      priority: body.priority,
      category: body.category,
      draftResponse: body.draftResponse,
      finalResponse: body.finalResponse,
      sentAt: body.sentAt,
    },
    include: { assignedTo: true },
  })

  // Auto-log engagement if a response was just sent (sentAt changed from null to a value)
  if (body.sentAt && !currentEnquiry?.sentAt && currentEnquiry?.submitterEmail) {
    const matchingStakeholder = await prisma.stakeholder.findFirst({
      where: {
        projectId: params.id,
        email: {
          equals: currentEnquiry.submitterEmail,
          mode: 'insensitive',
        },
      },
    })

    if (matchingStakeholder) {
      await prisma.stakeholderEngagement.create({
        data: {
          stakeholderId: matchingStakeholder.id,
          type: 'outbound_email',
          title: `Response sent: ${currentEnquiry.subject}`,
          description: body.finalResponse?.substring(0, 500) + (body.finalResponse?.length > 500 ? '...' : ''),
          date: new Date(),
          outcome: 'Response sent to enquiry',
        },
      })
    }
  }

  return NextResponse.json(enquiry)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  // Scope the delete to this project so an enquiry from another project
  // cannot be deleted via a mismatched projectId in the URL.
  const { count } = await prisma.enquiry.deleteMany({
    where: { id: params.enquiryId, projectId: params.id },
  })

  if (count === 0) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
