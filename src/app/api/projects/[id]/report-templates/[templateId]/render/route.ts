import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { buildFeedbackData, buildStakeholderData, renderDocx } from '@/lib/word-export'

export const runtime = 'nodejs'

// Fill the template with live project data and return the branded .docx.
export async function GET(request: Request, props: { params: Promise<{ id: string; templateId: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const template = await prisma.reportTemplate.findFirst({
    where: { id: params.templateId, projectId: params.id },
  })
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const data = template.kind === 'stakeholders'
    ? await buildStakeholderData(params.id)
    : await buildFeedbackData(params.id)

  let output: Buffer
  try {
    output = renderDocx(template.data, data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 422 })
  }

  await logAudit({
    projectId: params.id,
    action: 'report.render',
    targetType: 'ReportTemplate',
    targetId: template.id,
    detail: { kind: template.kind, name: template.name },
  })

  const slug = template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report'
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(new Uint8Array(output), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${slug}-${stamp}.docx"`,
    },
  })
}
