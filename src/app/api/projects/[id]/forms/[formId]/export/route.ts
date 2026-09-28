import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

/**
 * Per-form CSV export: one row per response, one column per question,
 * headers taken from the question labels. Prefixed with a UTF-8 BOM so
 * Excel opens it correctly on double-click.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string; formId: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const form = await prisma.feedbackForm.findFirst({
    where: { id: params.formId, projectId: params.id },
    include: { responses: { orderBy: { submittedAt: 'asc' } } },
  })
  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 })
  }

  const fields = (form.fields as Array<{ id: string; label: string }>) || []

  // A response value may be keyed by the field id (our own form page) or by
  // the field label (external submissions that auto-detect fields).
  const valueFor = (data: Record<string, unknown>, field: { id: string; label: string }) => {
    const value = data[field.id] !== undefined ? data[field.id] : data[field.label]
    return Array.isArray(value) ? value.join('; ') : value
  }

  // Extra keys that arrived on responses but aren't part of the form config
  // (external integrations can post additional fields) become trailing columns.
  const knownKeys = new Set<string>(['gdprConsent'])
  fields.forEach(f => { knownKeys.add(f.id); knownKeys.add(f.label) })
  const extraKeys: string[] = []
  form.responses.forEach(response => {
    Object.keys((response.data as Record<string, unknown>) || {}).forEach(key => {
      if (!knownKeys.has(key) && !extraKeys.includes(key)) extraKeys.push(key)
    })
  })

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const header = ['response_id', 'submitted_at', ...fields.map(f => f.label), ...extraKeys]
  const rows = [header.map(escape).join(',')]
  form.responses.forEach(response => {
    const data = (response.data as Record<string, unknown>) || {}
    rows.push(
      [
        response.id,
        response.submittedAt.toISOString(),
        ...fields.map(f => valueFor(data, f)),
        ...extraKeys.map(key => (Array.isArray(data[key]) ? (data[key] as unknown[]).join('; ') : data[key])),
      ].map(escape).join(',')
    )
  })

  await logAudit({
    projectId: params.id,
    action: 'form.export',
    targetType: 'FeedbackForm',
    targetId: form.id,
    detail: { responses: form.responses.length },
  })

  const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'form'
  const stamp = new Date().toISOString().slice(0, 10)
  // BOM so Excel detects UTF-8 (accented names, smart quotes) on double-click.
  return new NextResponse('\uFEFF' + rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-responses-${stamp}.csv"`,
    },
  })
}
