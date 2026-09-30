import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

export async function DELETE(request: Request, props: { params: Promise<{ id: string; templateId: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const template = await prisma.reportTemplate.findFirst({
    where: { id: params.templateId, projectId: params.id },
    select: { id: true, name: true, kind: true },
  })
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  await prisma.reportTemplate.delete({ where: { id: params.templateId } })
  await logAudit({
    projectId: params.id,
    action: 'report_template.delete',
    targetType: 'ReportTemplate',
    targetId: params.templateId,
    detail: { name: template.name, kind: template.kind },
  })
  return NextResponse.json({ success: true })
}
