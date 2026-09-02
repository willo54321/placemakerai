import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

const VALID_STATUSES = ['new', 'open', 'closed'] as const
type EnquiryStatus = (typeof VALID_STATUSES)[number]

// Shape of a single item in the rendered thread. The originating submission is
// synthesised as the first entry (id 'root') from the Enquiry record itself, so
// enquiries created before the thread model existed still render a full
// conversation with no backfill.
type ThreadEntry = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  authorName: string | null
  authorEmail: string | null
  deliveryStatus: string
  attachments: unknown
  createdAt: Date
  isOriginal: boolean
}

async function loadEnquiry(projectId: string, enquiryId: string) {
  return prisma.enquiry.findFirst({
    where: { id: enquiryId, projectId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
}

// GET - A single enquiry with its full conversation thread. Read access
// (CLIENT) is enough.
export async function GET(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const enquiry = await loadEnquiry(params.id, params.enquiryId)
  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const root: ThreadEntry = {
    id: 'root',
    direction: 'inbound',
    body: enquiry.message,
    authorName: enquiry.submitterName,
    authorEmail: enquiry.submitterEmail,
    deliveryStatus: 'delivered',
    attachments: null,
    createdAt: enquiry.createdAt,
    isOriginal: true,
  }

  const thread: ThreadEntry[] = [
    root,
    ...enquiry.messages.map(m => ({
      id: m.id,
      direction: m.direction as 'inbound' | 'outbound',
      body: m.body,
      authorName: m.authorName,
      authorEmail: m.authorEmail,
      deliveryStatus: m.deliveryStatus,
      attachments: m.attachments,
      createdAt: m.createdAt,
      isOriginal: false,
    })),
  ]

  return NextResponse.json({
    enquiry: {
      id: enquiry.id,
      submitterName: enquiry.submitterName,
      submitterEmail: enquiry.submitterEmail,
      submitterPhone: enquiry.submitterPhone,
      submitterOrg: enquiry.submitterOrg,
      subject: enquiry.subject,
      category: enquiry.category,
      status: enquiry.status,
      read: enquiry.read,
      assigneeId: enquiry.assigneeId,
      createdAt: enquiry.createdAt,
    },
    thread,
  })
}

// PATCH - Update desk state on an enquiry: mark read/unread, change status, or
// (re)assign. Requires ADMIN. Reply composition/sending is a later phase; this
// route deliberately does not create messages.
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    select: { id: true, status: true, read: true, assigneeId: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const data: { status?: EnquiryStatus; read?: boolean; assigneeId?: string | null } = {}

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    data.status = body.status
  }
  if (body.read !== undefined) {
    if (typeof body.read !== 'boolean') {
      return NextResponse.json({ error: 'read must be a boolean' }, { status: 400 })
    }
    data.read = body.read
  }
  if (body.assigneeId !== undefined) {
    data.assigneeId = body.assigneeId === null ? null : String(body.assigneeId)
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No supported fields to update' }, { status: 400 })
  }

  const updated = await prisma.enquiry.update({
    where: { id: existing.id },
    data,
  })

  // Only audit the meaningful desk transitions (status/assignment), not every
  // incidental read-marking as threads are opened.
  if (data.status !== undefined || data.assigneeId !== undefined) {
    await logAudit({
      projectId: params.id,
      action: 'enquiry.update',
      targetType: 'enquiry',
      targetId: existing.id,
      detail: {
        ...(data.status !== undefined ? { status: { from: existing.status, to: data.status } } : {}),
        ...(data.assigneeId !== undefined
          ? { assignee: { from: existing.assigneeId, to: data.assigneeId } }
          : {}),
      },
    })
  }

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    read: updated.read,
    assigneeId: updated.assigneeId,
  })
}
