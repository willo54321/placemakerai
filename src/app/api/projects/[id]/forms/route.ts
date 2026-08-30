import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()
  const created = await prisma.feedbackForm.create({
    data: {
      projectId: params.id,
      name: body.name,
      fields: body.fields,
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'form.create',
    targetType: 'FeedbackForm',
    targetId: created.id,
    detail: { name: created.name },
  })

  return NextResponse.json(created)
}
