import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const body = await request.json()
  const message = await prisma.enquiryMessage.create({
    data: {
      enquiryId: params.enquiryId,
      type: body.type || 'internal_note',
      content: body.content,
      authorName: body.authorName,
    },
  })

  // Update enquiry status to in_progress if it was new
  await prisma.enquiry.updateMany({
    where: { id: params.enquiryId, status: 'new' },
    data: { status: 'in_progress' },
  })

  return NextResponse.json(message)
}
