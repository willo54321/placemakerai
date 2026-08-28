import { prisma } from '@/lib/db'
import { sendMailingListEmail } from '@/lib/email'
import { authorizeProject } from '@/lib/api-auth'
import { appBaseUrl } from '@/lib/password-reset'
import { NextResponse } from 'next/server'

// GET all sent emails for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

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
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()
  const { subject, body: emailBody, sentBy } = body

  // Get all subscribed emails for this project
  const subscribers = await prisma.subscriber.findMany({
    where: {
      projectId: params.id,
      subscribed: true,
    },
    select: {
      id: true,
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

  // Send via Resend (one message per recipient)
  const { sent, failed } = await sendMailingListEmail({
    to: subscribers.map(s => ({
      email: s.email,
      name: s.name,
      unsubscribeUrl: `${appBaseUrl()}/unsubscribe?sid=${s.id}`,
    })),
    subject,
    body: emailBody,
    projectName: project?.name || 'Project',
    projectEmailFromName: project?.emailFromName,
    projectEmailFromAddress: project?.emailFromAddress,
  })

  const emailSent = sent > 0
  const status = emailSent ? 'sent' : 'failed'

  // Only record the email in history when at least one message was delivered.
  // recipientCount reflects how many were actually sent.
  let projectEmail = null
  if (emailSent) {
    projectEmail = await prisma.projectEmail.create({
      data: {
        projectId: params.id,
        subject,
        body: emailBody,
        sentBy,
        recipientCount: sent,
        status,
      },
    })
  }

  // Only log stakeholder engagement when the broadcast actually went out.
  let matchingStakeholders: { id: string }[] = []
  if (emailSent) {
    // Auto-log engagement for any subscribers who are also stakeholders
    const subscriberEmails = subscribers.map(s => s.email.toLowerCase())

    matchingStakeholders = await prisma.stakeholder.findMany({
      where: {
        projectId: params.id,
        email: {
          in: subscriberEmails,
          mode: 'insensitive',
        },
      },
      select: { id: true },
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
          outcome: `Sent as part of mailing list broadcast to ${sent} recipient(s)`,
        })),
      })
    }
  }

  return NextResponse.json(
    {
      ...(projectEmail || {}),
      emailSent,
      status,
      sent,
      failed,
      recipientCount: sent,
      stakeholderEngagementsLogged: matchingStakeholders.length,
    },
    { status: emailSent ? 200 : 502 }
  )
}
