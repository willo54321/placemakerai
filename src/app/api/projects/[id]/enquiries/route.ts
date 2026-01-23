import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const assignedToId = searchParams.get('assignedToId')

  const where: Record<string, unknown> = { projectId: params.id }
  if (status) where.status = status
  if (assignedToId) where.assignedToId = assignedToId

  const enquiries = await prisma.enquiry.findMany({
    where,
    include: {
      assignedTo: true,
      _count: { select: { messages: true, queries: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(enquiries)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const enquiry = await prisma.enquiry.create({
    data: {
      projectId: params.id,
      submitterName: body.submitterName,
      submitterEmail: body.submitterEmail,
      submitterPhone: body.submitterPhone || null,
      submitterOrg: body.submitterOrg || null,
      subject: body.subject,
      message: body.message,
      category: body.category || 'general',
      priority: body.priority || 'normal',
    },
    include: { assignedTo: true },
  })

  // Auto-add to mailing list
  if (body.submitterEmail) {
    try {
      await prisma.subscriber.upsert({
        where: {
          projectId_email: {
            projectId: params.id,
            email: body.submitterEmail.toLowerCase(),
          },
        },
        create: {
          projectId: params.id,
          email: body.submitterEmail.toLowerCase(),
          name: body.submitterName || null,
          source: 'enquiry',
          sourceId: enquiry.id,
        },
        update: {
          name: body.submitterName || undefined,
          subscribed: true,
          unsubscribedAt: null,
        },
      })
    } catch (error) {
      console.error('Failed to add subscriber from enquiry:', error)
    }
  }

  return NextResponse.json(enquiry)
}
