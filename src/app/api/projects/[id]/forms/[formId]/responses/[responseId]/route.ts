import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

// Delete a single form response (e.g. test submissions). Removal takes it
// out of the analysis corpus on the next run and out of exports immediately.
export async function DELETE(request: Request, props: { params: Promise<{ id: string; formId: string; responseId: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  // Verify the full chain: response → form → this project.
  const response = await prisma.feedbackResponse.findFirst({
    where: { id: params.responseId, formId: params.formId, form: { projectId: params.id } },
  })
  if (!response) {
    return NextResponse.json({ error: 'Response not found' }, { status: 404 })
  }

  await prisma.feedbackResponse.delete({ where: { id: params.responseId } })

  await logAudit({
    projectId: params.id,
    action: 'form.response.delete',
    targetType: 'FeedbackResponse',
    targetId: params.responseId,
    detail: { formId: params.formId, submittedAt: response.submittedAt.toISOString() },
  })

  return NextResponse.json({ success: true })
}
