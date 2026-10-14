import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { requireAuth } from '@/lib/permissions'
import { sendEnquiryReply } from '@/lib/email'
import { getProjectReplyAddress, inboundEmailEnabled } from '@/lib/email-identity'
import { parseCopiedRecipients, withSignature } from '@/lib/email-compose'
import { logAudit } from '@/lib/audit'

// GET - List a project's enquiries for the desk inbox. Read access (CLIENT) is
// enough to view; mutations live on the per-enquiry route and require ADMIN.
// Returns a lightweight row per enquiry plus a message count and the time of
// the most recent reply, so the inbox can show unread/activity without loading
// every thread.
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const enquiries = await prisma.enquiry.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, direction: true },
      },
      _count: { select: { messages: true } },
    },
  })

  const rows = enquiries.map(enquiry => {
    const latest = enquiry.messages[0]
    return {
      id: enquiry.id,
      submitterName: enquiry.submitterName,
      submitterEmail: enquiry.submitterEmail,
      submitterOrg: enquiry.submitterOrg,
      subject: enquiry.subject,
      category: enquiry.category,
      status: enquiry.status,
      read: enquiry.read,
      assigneeId: enquiry.assigneeId,
      channel: enquiry.channel as 'form' | 'email' | 'outbound',
      // A team-started thread's first message is the email itself, not a reply.
      replyCount: enquiry._count.messages - (enquiry.channel === 'outbound' ? 1 : 0),
      lastActivityAt: latest?.createdAt ?? enquiry.createdAt,
      createdAt: enquiry.createdAt,
    }
  })

  return NextResponse.json({ enquiries: rows })
}

// POST - Start a new thread by emailing someone (e.g. a stakeholder) who
// hasn't contacted the project. Stored as an Enquiry with channel 'outbound'
// whose first message is the sent email, so replies thread back in exactly
// like enquiry replies. Requires ADMIN.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied
  const user = await requireAuth()

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true, emailLocalPart: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const raw = await request.json().catch(() => ({}))
  const to = typeof raw.to === 'string' ? raw.to.trim().toLowerCase() : ''
  const toName = typeof raw.toName === 'string' ? raw.toName.trim().slice(0, 200) : ''
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : ''
  const text = typeof raw.body === 'string' ? raw.body.trim() : ''

  const errors: string[] = []
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) errors.push('to must be a valid email address')
  if (!subject) errors.push('subject is required')
  else if (subject.length > 300) errors.push('subject is too long (300 character limit)')
  if (!text) errors.push('body is required')
  else if (text.length > 10000) errors.push('body is too long (10,000 character limit)')
  const copied = parseCopiedRecipients(raw, to)
  if (copied.error) errors.push(copied.error)
  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { emailSignature: true } })
  const sentBody = withSignature(text, sender?.emailSignature)

  // Same reply routing as enquiry replies: a tagged Reply-To threads answers
  // back into this conversation when inbound email is configured.
  const threadToken = inboundEmailEnabled() && project.emailLocalPart
    ? crypto.randomBytes(8).toString('hex')
    : null

  const enquiry = await prisma.enquiry.create({
    data: {
      projectId: params.id,
      submitterName: toName || to,
      submitterEmail: to,
      subject,
      message: text,
      status: 'open',
      read: true,
      channel: 'outbound',
      threadToken,
    },
  })

  const result = await sendEnquiryReply({
    to,
    toName: toName || null,
    cc: copied.cc,
    bcc: copied.bcc,
    subject,
    body: sentBody,
    replyTo: (threadToken && getProjectReplyAddress(project, `e-${threadToken}`)) || user.email || null,
    project,
    kind: 'new',
  })
  const deliveryStatus =
    result.status === 'sent' ? 'sent' : result.status === 'skipped' ? 'stored' : 'failed'

  await prisma.enquiryMessage.create({
    data: {
      enquiryId: enquiry.id,
      direction: 'outbound',
      body: sentBody,
      authorName: user.name ?? null,
      authorEmail: user.email ?? null,
      deliveryStatus,
      cc: copied.cc,
      bcc: copied.bcc,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'enquiry.compose',
    targetType: 'enquiry',
    targetId: enquiry.id,
    detail: { deliveryStatus, cc: copied.cc.length, bcc: copied.bcc.length },
  })

  return NextResponse.json({ id: enquiry.id, delivery: result.status }, { status: 201 })
}
