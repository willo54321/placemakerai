import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { TEMPLATE_KINDS, TemplateKind, validateTemplate } from '@/lib/word-export'

export const runtime = 'nodejs'

const MAX_TEMPLATE_BYTES = 5 * 1024 * 1024

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const templates = await prisma.reportTemplate.findMany({
    where: { projectId: params.id },
    select: { id: true, name: true, kind: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(templates)
}

// Upload a company .docx template. Validated at upload time: it must be a
// real .docx and its tags must fill against sample data, so a broken
// template fails here with a readable error, not at export time.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  let file: File | null = null
  let kind = ''
  try {
    const formData = await request.formData()
    const entry = formData.get('file')
    if (entry instanceof File) file = entry
    kind = String(formData.get('kind') || '')
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with "file" and "kind"' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!TEMPLATE_KINDS.includes(kind as TemplateKind)) {
    return NextResponse.json({ error: `kind must be one of: ${TEMPLATE_KINDS.join(', ')}` }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return NextResponse.json({ error: 'Template must be a .docx file' }, { status: 400 })
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return NextResponse.json({ error: 'Template too large (5MB maximum)' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  try {
    validateTemplate(bytes, kind as TemplateKind)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  const template = await prisma.reportTemplate.create({
    data: {
      projectId: params.id,
      name: file.name.replace(/\.docx$/i, '').slice(0, 120),
      kind,
      data: bytes,
    },
    select: { id: true, name: true, kind: true, createdAt: true },
  })

  await logAudit({
    projectId: params.id,
    action: 'report_template.upload',
    targetType: 'ReportTemplate',
    targetId: template.id,
    detail: { name: template.name, kind, bytes: file.size },
  })

  return NextResponse.json(template)
}
