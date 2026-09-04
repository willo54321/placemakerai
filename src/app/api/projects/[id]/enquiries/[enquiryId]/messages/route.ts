import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { requireAuth } from '@/lib/permissions'
import { sendEnquiryReply } from '@/lib/email'
import { logAudit } from '@/lib/audit'

// POST - Send a staff reply to an enquiry. Creates an outbound EnquiryMessage,
// emails the enquirer (Reply-To = the responding admin), and records the
// delivery outcome. Requires ADMIN.
export async function POST(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied
  const user = await requireAuth()

  const enquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    include: { project: { select: { name: true } } },
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

  const subject = /^re:/i.test(enquiry.subject) ? enquiry.subject : `Re: ${enquiry.subject}`

  const result = await sendEnquiryReply({
    to: enquiry.submitterEmail,
    toName: enquiry.submitterName,
    subject,
    body: text,
    replyTo: user.email ?? null,
    projectName: enquiry.project?.name,
  })

  const deliveryStatus =
    result.status === 'sent' ? 'sent' : result.status === 'skipped' ? 'stored' : 'failed'

  const message = await prisma.enquiryMessage.create({
    data: {
      enquiryId: enquiry.id,
      direction: 'outbound',
      body: text,
      authorName: user.name ?? null,
      authorEmail: user.email ?? null,
      deliveryStatus,
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
    detail: { messageId: message.id, deliveryStatus },
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
        createdAt: message.createdAt,
        isOriginal: false,
      },
      delivery: result.status,
    },
    { status: 201 }
  )
}
