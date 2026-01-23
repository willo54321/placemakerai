import { prisma } from '@/lib/db'
import { sendMailingListEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

// GET all sent emails for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const emails = await prisma.projectEmail.findMany({
    where: { projectId: params.id },
    orderBy: { sentAt: 'desc' },
  })
  return NextResponse.json(emails)
}

// POST - send an email to all subscribers
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { subject, body: emailBody, sentBy } = body

  // Get all subscribed emails for this project
  const subscribers = await prisma.subscriber.findMany({
    where: {
      projectId: params.id,
      subscribed: true,
    },
    select: {
      email: true,
      name: true,
    },
  })

  if (subscribers.length === 0) {
    return NextResponse.json(
      { error: 'No subscribers to send to' },
      { status: 400 }
    )
  }

  // Get project details for the email
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true, emailFromName: true, emailFromAddress: true },
  })

  // Send via Resend
  const emailResult = await sendMailingListEmail({
    to: subscribers.map(s => s.email),
    subject,
    body: emailBody,
    projectName: project?.name || 'Project',
    projectEmailFromName: project?.emailFromName,
    projectEmailFromAddress: project?.emailFromAddress,
  })

  // Record the email in the database
  const projectEmail = await prisma.projectEmail.create({
    data: {
      projectId: params.id,
      subject,
      body: emailBody,
      sentBy,
      recipientCount: subscribers.length,
    },
  })

  // Auto-log engagement for any subscribers who are also stakeholders
  const subscriberEmails = subscribers.map(s => s.email.toLowerCase())

  const matchingStakeholders = await prisma.stakeholder.findMany({
    where: {
      projectId: params.id,
      email: {
        in: subscriberEmails,
        mode: 'insensitive',
      },
    },
  })

  // Create engagement records for each matching stakeholder
  if (matchingStakeholders.length > 0) {
    await prisma.stakeholderEngagement.createMany({
      data: matchingStakeholders.map(stakeholder => ({
        stakeholderId: stakeholder.id,
        type: 'outbound_email',
        title: `Email sent: ${subject}`,
        description: emailBody.substring(0, 500) + (emailBody.length > 500 ? '...' : ''),
        date: new Date(),
        outcome: `Sent as part of mailing list broadcast to ${subscribers.length} recipients`,
      })),
    })
  }

  return NextResponse.json({
    ...projectEmail,
    recipients: subscribers,
    stakeholderEngagementsLogged: matchingStakeholders.length,
    emailSent: !!emailResult,
  })
}
