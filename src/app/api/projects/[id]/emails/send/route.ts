import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// POST - send a direct email to specific recipients
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const { to, subject, message, sentBy } = body

  if (!to || !subject || !message) {
    return NextResponse.json(
      { error: 'to, subject, and message are required' },
      { status: 400 }
    )
  }

  // Get project details for the email
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true, emailFromName: true, emailFromAddress: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: 'Email sending not configured (RESEND_API_KEY missing)' },
      { status: 500 }
    )
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Build from address
  const fromName = project.emailFromName || project.name || 'Project Team'
  const fromAddress = project.emailFromAddress || process.env.EMAIL_FROM || 'onboarding@resend.dev'
  const from = `${fromName} <${fromAddress}>`

  // Parse recipients - can be string or array
  const recipients = Array.isArray(to) ? to : [to]

  try {
    // Send via Resend
    const { data, error } = await resend.emails.send({
      from,
      to: recipients,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; color: #1e293b;">${message}</div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            Sent by ${project.name}
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Record the email in the database
    const projectEmail = await prisma.projectEmail.create({
      data: {
        projectId: params.id,
        subject,
        body: message,
        sentBy: sentBy || 'System',
        recipientCount: recipients.length,
      },
    })

    // Auto-log engagement for any recipients who are stakeholders
    const matchingStakeholders = await prisma.stakeholder.findMany({
      where: {
        projectId: params.id,
        email: {
          in: recipients.map(e => e.toLowerCase()),
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
          description: message.substring(0, 500) + (message.length > 500 ? '...' : ''),
          date: new Date(),
          outcome: `Direct email sent`,
        })),
      })
    }

    return NextResponse.json({
      success: true,
      emailId: data?.id,
      projectEmailId: projectEmail.id,
      recipientCount: recipients.length,
      stakeholderEngagementsLogged: matchingStakeholders.length,
    })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
