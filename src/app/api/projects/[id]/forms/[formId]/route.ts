import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; formId: string } }
) {
  const form = await prisma.feedbackForm.findUnique({
    where: { id: params.formId },
    include: { responses: true },
  })
  return NextResponse.json(form)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; formId: string } }
) {
  await prisma.feedbackForm.delete({
    where: { id: params.formId },
  })
  return NextResponse.json({ success: true })
}
