import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

/**
 * Stakeholder engagement export: one row per engagement, newest last, with
 * the stakeholder's register details on every row. Stakeholders with no
 * engagements yet still appear as a single row (empty engagement columns),
 * so unreached targets are visible in the same file. UTF-8 BOM for Excel.
 */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const stakeholders = await prisma.stakeholder.findMany({
    where: { projectId: params.id },
    include: { engagements: { orderBy: { date: 'asc' } } },
    orderBy: { name: 'asc' },
  })

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
