import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; formId: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const form = await prisma.feedbackForm.findFirst({
    where: { id: params.formId, projectId: params.id },
    include: { responses: true },
  })

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  return NextResponse.json(form)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; formId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const form = await prisma.feedbackForm.findFirst({
    where: { id: params.formId, projectId: params.id },
  })

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  await prisma.feedbackForm.delete({
    where: { id: params.formId },
  })

  await logAudit({
    projectId: params.id,
    action: 'form.delete',
    targetType: 'FeedbackForm',
    targetId: params.formId,
    detail: { name: form.name },
  })

  return NextResponse.json({ success: true })
}
