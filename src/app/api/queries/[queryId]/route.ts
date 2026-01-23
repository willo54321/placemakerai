import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { queryId: string } }
) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  const query = await prisma.enquiryQuery.findFirst({
    where: {
      id: params.queryId,
      token: token || undefined,
    },
    include: {
      teamMember: true,
      enquiry: {
        select: {
          subject: true,
          message: true,
          submitterName: true,
          category: true,
        },
      },
    },
  })

  if (!query) {
    return NextResponse.json({ error: 'Query not found' }, { status: 404 })
  }

  return NextResponse.json(query)
}

export async function POST(
  request: Request,
  { params }: { params: { queryId: string } }
) {
  const body = await request.json()
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  // Verify token
  const existingQuery = await prisma.enquiryQuery.findFirst({
    where: { id: params.queryId, token: token || undefined },
  })

  if (!existingQuery) {
    return NextResponse.json({ error: 'Invalid query or token' }, { status: 403 })
  }

  const query = await prisma.enquiryQuery.update({
    where: { id: params.queryId },
    data: {
      response: body.response,
      status: 'responded',
      respondedAt: new Date(),
    },
    include: { teamMember: true },
  })

  // Add message to the enquiry
  await prisma.enquiryMessage.create({
    data: {
      enquiryId: query.enquiryId,
      type: 'query_response',
      content: `Response from ${query.teamMember.name}: ${body.response}`,
      authorName: query.teamMember.name,
    },
  })

  // Check if all queries are responded, update status
  const pendingQueries = await prisma.enquiryQuery.count({
    where: { enquiryId: query.enquiryId, status: 'pending' },
  })

  if (pendingQueries === 0) {
    await prisma.enquiry.update({
      where: { id: query.enquiryId },
      data: { status: 'in_progress' },
    })
  }

  return NextResponse.json(query)
}
