import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { sendQueryEmail } from '@/lib/email'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export async function POST(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Get enquiry details for the email, scoped to this project so an enquiry
  // from another project cannot be queried via a mismatched URL.
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    select: {
      subject: true,
      message: true,
      submitterName: true,
      project: {
        select: { emailFromName: true, emailFromAddress: true },
      },
    },
  })

  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const query = await prisma.enquiryQuery.create({
    data: {
      enquiryId: params.enquiryId,
      teamMemberId: body.teamMemberId,
      question: body.question,
    },
    include: { teamMember: true },
  })

  // Update enquiry status to awaiting_info
  await prisma.enquiry.update({
    where: { id: params.enquiryId },
    data: { status: 'awaiting_info' },
  })

  // Build the query response URL
  const headersList = headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const queryUrl = `${protocol}://${host}/queries/${query.id}?token=${query.token}`

  // Send email notification to team member
  await sendQueryEmail({
    to: query.teamMember.email,
    teamMemberName: query.teamMember.name,
    question: body.question,
    enquirySubject: enquiry.subject,
    enquiryMessage: enquiry.message,
    submitterName: enquiry.submitterName,
    queryUrl,
    projectEmailFromName: enquiry.project.emailFromName,
    projectEmailFromAddress: enquiry.project.emailFromAddress,
  })

  return NextResponse.json(query)
}
