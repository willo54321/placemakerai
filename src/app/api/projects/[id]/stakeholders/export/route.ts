import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { buildStakeholderWorkbook } from '@/lib/stakeholder-xlsx'

/**
 * Stakeholder tracker export.
 *
 * Default (CSV): one row per engagement, newest last, with the stakeholder's
 * register details on every row. Stakeholders with no engagements yet still
 * appear as a single row (empty engagement columns), so unreached targets are
 * visible in the same file. UTF-8 BOM for Excel.
 *
 * ?format=xlsx: styled workbook — Register / Engagement log / Summary sheets
 * (see src/lib/stakeholder-xlsx.ts).
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const format = new URL(request.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv'

  const stakeholders = await prisma.stakeholder.findMany({
    where: { projectId: params.id },
    include: { engagements: { orderBy: { date: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  if (format === 'xlsx') {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: { name: true },
    })
    const buffer = await buildStakeholderWorkbook(project?.name ?? 'Project', stakeholders)

    await logAudit({
      projectId: params.id,
      action: 'stakeholder.export',
      targetType: 'Project',
      targetId: params.id,
      detail: {
        format: 'xlsx',
        stakeholders: stakeholders.length,
        engagements: stakeholders.reduce((n, s) => n + s.engagements.length, 0),
      },
    })

    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="stakeholder-tracker-${stamp}.xlsx"`,
      },
    })
  }

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const dateOf = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')

  const rows = [
    [
      'stakeholder', 'role', 'organisation', 'type', 'stance', 'influence', 'interest',
      'email', 'phone', 'stakeholder_notes',
      'engagement_date', 'engagement_type', 'engagement_title', 'engagement_detail', 'outcome', 'next_action',
    ].map(escape).join(','),
  ]

  let engagementCount = 0
  for (const s of stakeholders) {
    const base = [s.name, s.role, s.organization, s.type, s.category, s.influence, s.interest, s.email, s.phone, s.notes]
    if (s.engagements.length === 0) {
      rows.push([...base, '', '', '', '', '', ''].map(escape).join(','))
      continue
    }
    for (const e of s.engagements) {
      rows.push([...base, dateOf(e.date), e.type, e.title, e.description, e.outcome, e.nextAction].map(escape).join(','))
      engagementCount++
    }
  }

  await logAudit({
    projectId: params.id,
    action: 'stakeholder.export',
    targetType: 'Project',
    targetId: params.id,
    detail: { stakeholders: stakeholders.length, engagements: engagementCount },
  })

  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse('\uFEFF' + rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="stakeholder-engagement-${stamp}.csv"`,
    },
  })
}
