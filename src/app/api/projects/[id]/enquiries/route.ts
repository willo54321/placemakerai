import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'

// GET - List a project's enquiries for the desk inbox. Read access (CLIENT) is
// enough to view; mutations live on the per-enquiry route and require ADMIN.
// Returns a lightweight row per enquiry plus a message count and the time of
// the most recent reply, so the inbox can show unread/activity without loading
// every thread.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      // The only channel today is the embed enquiry form. Inbound email lands
      // in Phase 2 and will set this per-message; surfaced now so the inbox
      // filter has a stable shape to build against.
      channel: 'form' as const,
      replyCount: enquiry._count.messages,
      lastActivityAt: latest?.createdAt ?? enquiry.createdAt,
      createdAt: enquiry.createdAt,
    }
  })

  return NextResponse.json({ enquiries: rows })
}
