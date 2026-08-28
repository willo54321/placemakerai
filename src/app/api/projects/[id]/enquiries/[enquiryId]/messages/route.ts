import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string; enquiryId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Verify the enquiry belongs to this project before creating a message.
  const enquiry = await prisma.enquiry.findFirst({
    where: { id: params.enquiryId, projectId: params.id },
    select: { id: true },
  })

  if (!enquiry) {
    return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
  }

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
