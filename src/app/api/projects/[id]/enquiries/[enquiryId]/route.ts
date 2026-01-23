import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: params.enquiryId },
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
  const body = await request.json()

  // Get the current enquiry to check if this is a new response being sent
  const currentEnquiry = await prisma.enquiry.findUnique({
    where: { id: params.enquiryId },
    select: { sentAt: true, submitterEmail: true, subject: true },
  })

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
  await prisma.enquiry.delete({
    where: { id: params.enquiryId },
  })
  return NextResponse.json({ success: true })
}
