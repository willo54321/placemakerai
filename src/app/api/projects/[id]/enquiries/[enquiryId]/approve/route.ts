import { prisma } from '@/lib/db'
import { sendEnquiryResponseEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  try {
    const body = await request.json()

    // Get project name and email config
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true, emailFromName: true, emailFromAddress: true },
    })

    const responseContent = body.response || ''
    if (!responseContent.trim()) {
      return NextResponse.json(
        { error: 'Response content is required' },
        { status: 400 }
      )
    }

    // Get the enquiry for email details
    const existingEnquiry = await prisma.enquiry.findUnique({
      where: { id: params.enquiryId },
      select: { submitterEmail: true, submitterName: true, subject: true, draftResponse: true },
    })

    if (!existingEnquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    // Send email with correct details
    const emailSent = await sendEnquiryResponseEmail({
      to: existingEnquiry.submitterEmail,
      submitterName: existingEnquiry.submitterName,
      subject: existingEnquiry.subject,
      response: responseContent,
      projectName: project?.name || 'Consultation',
      projectEmailFromName: project?.emailFromName,
      projectEmailFromAddress: project?.emailFromAddress,
    })

    // Update enquiry status
    const enquiry = await prisma.enquiry.update({
      where: { id: params.enquiryId },
      data: {
        status: 'sent',
        finalResponse: responseContent,
        sentAt: new Date(),
      },
      include: { assignedTo: true },
    })

    // Add a message recording the sent response
    await prisma.enquiryMessage.create({
      data: {
        enquiryId: params.enquiryId,
        type: 'response_sent',
        content: responseContent,
        authorName: body.authorName || 'System',
      },
    })

    return NextResponse.json({
      ...enquiry,
      emailSent: !!emailSent,
      message: emailSent ? 'Response sent successfully' : 'Response saved but email could not be sent (check RESEND_API_KEY)',
    })
  } catch (error) {
    console.error('Error approving enquiry:', error)
    return NextResponse.json(
      { error: 'Failed to send response' },
      { status: 500 }
    )
  }
}
