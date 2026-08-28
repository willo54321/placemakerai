import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const form = await prisma.feedbackForm.findUnique({
    where: { id: params.id },
  })
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }
  return NextResponse.json(form)
}
