import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { requireAuth } from '@/lib/permissions'
import { sendEnquiryReply } from '@/lib/email'
import { getProjectReplyAddress, inboundEmailEnabled } from '@/lib/email-identity'
import { logAudit } from '@/lib/audit'
import { parseCopiedRecipients, withSignature } from '@/lib/email-compose'

// POST - Send a staff reply to an enquiry. Creates an outbound EnquiryMessage,
// emails the enquirer (plus any CC/BCC) with the sender's signature appended,
// and records the delivery outcome. Requires ADMIN.
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string; enquiryId: string }> }
) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied
  const user = await requireAuth()

  let enquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    include: { project: { select: { name: true, emailLocalPart: true } } },
  })
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const raw = await request.json().catch(() => ({}))
  const text = typeof raw.body === 'string' ? raw.body.trim() : ''
  if (!text) {
    return NextResponse.json({ error: 'Reply body is required' }, { status: 400 })
  }
  if (text.length > 10000) {
    return NextResponse.json({ error: 'Reply is too long (10,000 character limit)' }, { status: 400 })
  }
  const copied = parseCopiedRecipients(raw, enquiry.submitterEmail)
  if (copied.error) {
    return NextResponse.json({ error: copied.error }, { status: 400 })
  }

  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { emailSignature: true } })
  const sentBody = withSignature(text, sender?.emailSignature)

  const subject = /^re:/i.test(enquiry.subject) ? enquiry.subject : `Re: ${enquiry.subject}`

  // With inbound email configured, replies route back into this thread via a
  // tagged Reply-To (threadToken minted on first use); otherwise they go to
  // the responding admin's own inbox.
  if (inboundEmailEnabled() && enquiry.project?.emailLocalPart && !enquiry.threadToken) {
    enquiry = {
      ...enquiry,
      ...(await prisma.enquiry.update({
        where: { id: enquiry.id },
        data: { threadToken: crypto.randomBytes(8).toString('hex') },
      })),
    }
  }
  const threadReplyAddress =
    enquiry.threadToken && enquiry.project
      ? getProjectReplyAddress(enquiry.project, `e-${enquiry.threadToken}`)
      : null

  const result = await sendEnquiryReply({
    to: enquiry.submitterEmail,
    toName: enquiry.submitterName,
    cc: copied.cc,
    bcc: copied.bcc,
    subject,
    body: sentBody,
    replyTo: threadReplyAddress ?? user.email ?? null,
    project: enquiry.project,
  })

  const deliveryStatus =
    result.status === 'sent' ? 'sent' : result.status === 'skipped' ? 'stored' : 'failed'

  const message = await prisma.enquiryMessage.create({
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

  // Sending a reply moves the enquiry along and marks it read.
  if (enquiry.status === 'new' || !enquiry.read) {
    await prisma.enquiry.update({
      where: { id: enquiry.id },
      data: { status: enquiry.status === 'new' ? 'open' : enquiry.status, read: true },
    })
  }

  await logAudit({
    projectId: params.id,
    action: 'enquiry.reply',
    targetType: 'enquiry',
    targetId: enquiry.id,
    detail: { messageId: message.id, deliveryStatus, cc: copied.cc.length, bcc: copied.bcc.length },
  })

  return NextResponse.json(
    {
      message: {
        id: message.id,
        direction: 'outbound' as const,
        body: message.body,
        authorName: message.authorName,
        authorEmail: message.authorEmail,
        deliveryStatus: message.deliveryStatus,
        attachments: null,
        cc: message.cc,
        bcc: message.bcc,
        createdAt: message.createdAt,
        isOriginal: false,
      },
      delivery: result.status,
    },
    { status: 201 }
  )
}
