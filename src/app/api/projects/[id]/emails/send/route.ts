import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { escapeHtml, escapeHtmlWithBreaks } from '@/lib/escape-html'
import { personalizeTemplate } from '@/lib/email'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// POST - send a direct email to specific recipients
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

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

  // Parse requested recipients - can be string or array
  const requested = (Array.isArray(to) ? to : [to])
    .filter((e): e is string => typeof e === 'string' && e.trim().length > 0)
    .map(e => e.trim())

  // Build the set of addresses that belong to THIS project. Recipients must be
  // one of the project's stakeholders, subscribers, or team members. This
  // prevents the endpoint from being abused to send mail to arbitrary
  // addresses.
  const [stakeholders, subscribers, teamMembers, projectAccess] = await Promise.all([
    prisma.stakeholder.findMany({
      where: { projectId: params.id, email: { not: null } },
      select: { email: true, name: true },
    }),
    prisma.subscriber.findMany({
      where: { projectId: params.id },
      select: { email: true, name: true },
    }),
    prisma.teamMember.findMany({
      where: { projectId: params.id },
      select: { email: true, name: true },
    }),
    prisma.projectAccess.findMany({
      where: { projectId: params.id },
      select: { user: { select: { email: true, name: true } } },
    }),
  ])

  // Track each allowed address's display name so {{name}} can be substituted
  // per recipient. First non-empty name wins.
  const allowedRecipients = new Map<string, string | null>()
  const addAllowed = (email: string | null | undefined, name: string | null | undefined) => {
    if (!email) return
    const key = email.toLowerCase()
    if (!allowedRecipients.has(key) || (!allowedRecipients.get(key) && name)) {
      allowedRecipients.set(key, name || null)
    }
  }
  for (const s of stakeholders) addAllowed(s.email, s.name)
  for (const s of subscribers) addAllowed(s.email, s.name)
  for (const t of teamMembers) addAllowed(t.email, t.name)
  for (const a of projectAccess) addAllowed(a.user?.email, a.user?.name)

  const recipients = requested.filter(e => allowedRecipients.has(e.toLowerCase()))
  const rejected = requested.filter(e => !allowedRecipients.has(e.toLowerCase()))

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error: 'No valid recipients. Recipients must belong to this project (stakeholders, subscribers, or team members).',
        rejected,
      },
      { status: 400 }
    )
  }

  try {
    // Send one message per recipient so {{name}} personalizes correctly and
    // recipients never see each other's addresses. Resend's batch endpoint
    // accepts up to 100 messages per call.
    const buildHtml = (personalizedMessage: string) => `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="white-space: pre-wrap; color: #1e293b;">${escapeHtmlWithBreaks(personalizedMessage)}</div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

          <p style="color: #94a3b8; font-size: 12px;">
            Sent by ${escapeHtml(project.name)}
          </p>
        </div>
      `

    let sentCount = 0
    let lastError: string | null = null
    const BATCH_SIZE = 100
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const chunk = recipients.slice(i, i + BATCH_SIZE)
      const messages = chunk.map(recipient => {
        const name = allowedRecipients.get(recipient.toLowerCase()) || null
        const vars = { name, subject, project: project.name }
        return {
          from,
          to: [recipient],
          subject: personalizeTemplate(subject, vars),
          html: buildHtml(personalizeTemplate(message, vars)),
        }
      })

      const { data, error } = await resend.batch.send(messages)
      if (error) {
        console.error('Resend error:', error)
        lastError = error.message
      } else {
        sentCount += Array.isArray(data?.data) ? data.data.length : chunk.length
      }
    }

    if (sentCount === 0) {
      // Record the failed attempt in history.
      await prisma.projectEmail.create({
        data: {
          projectId: params.id,
          subject,
          body: message,
          sentBy: sentBy || 'System',
          recipientCount: 0,
          status: 'failed',
        },
      })
      return NextResponse.json(
        { error: lastError || 'Failed to send email', emailSent: false },
        { status: 502 }
      )
    }

    // Record the successfully sent email in the database
    const projectEmail = await prisma.projectEmail.create({
      data: {
        projectId: params.id,
        subject,
        body: message,
        sentBy: sentBy || 'System',
        recipientCount: sentCount,
        status: 'sent',
      },
    })

    // Auto-log engagement for any valid recipients who are stakeholders
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
      emailSent: true,
      projectEmailId: projectEmail.id,
      recipientCount: sentCount,
      rejected,
      stakeholderEngagementsLogged: matchingStakeholders.length,
    })
  } catch (err) {
    console.error('Email send error:', err)
    return NextResponse.json(
      { error: 'Failed to send email', emailSent: false },
      { status: 500 }
    )
  }
}
