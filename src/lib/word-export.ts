import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { prisma } from '@/lib/db'

/**
 * Word report exports: company .docx templates with {tags}, filled from live
 * project data by docxtemplater. Two data schemas ("kinds"):
 *   - stakeholders: register + engagement log
 *   - feedback: participation counts + the cached AI analysis
 * Starter templates showing every tag live in public/report-templates/.
 */

export const TEMPLATE_KINDS = ['stakeholders', 'feedback'] as const
export type TemplateKind = (typeof TEMPLATE_KINDS)[number]

const dateFmt = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

/** Compile + render a .docx template. Throws Error with a readable message. */
export function renderDocx(templateBytes: Buffer | Uint8Array, data: Record<string, unknown>): Buffer {
  let doc: Docxtemplater
  try {
    const zip = new PizZip(Buffer.from(templateBytes))
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    })
  } catch (err) {
    throw new Error(`Not a valid Word template: ${describeDocxError(err)}`)
  }
  try {
    doc.render(data)
  } catch (err) {
    throw new Error(`Template tags could not be filled: ${describeDocxError(err)}`)
  }
  return doc.getZip().generate({ type: 'nodebuffer' })
}

/** Validate an uploaded template compiles and its tags fill against sample data. */
export function validateTemplate(bytes: Buffer, kind: TemplateKind) {
  renderDocx(bytes, sampleData(kind))
}

function describeDocxError(err: unknown): string {
  const e = err as { properties?: { errors?: Array<{ properties?: { explanation?: string } }>; explanation?: string }; message?: string }
  const inner = e?.properties?.errors
    ?.map(x => x?.properties?.explanation)
    .filter(Boolean)
  if (inner?.length) return inner.slice(0, 3).join('; ')
  return e?.properties?.explanation || e?.message || 'unknown error'
}

export async function buildStakeholderData(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
  const stakeholders = await prisma.stakeholder.findMany({
    where: { projectId },
    include: { engagements: { orderBy: { date: 'asc' } } },
    orderBy: { name: 'asc' },
  })

  let engagementTotal = 0
  const rows = stakeholders.map(s => {
    engagementTotal += s.engagements.length
    const last = s.engagements[s.engagements.length - 1]
    return {
      name: s.name,
      role: s.role || '',
      organisation: s.organization || '',
      stance: s.category || '',
      influence: s.influence ?? '',
      interest: s.interest ?? '',
      email: s.email || '',
      phone: s.phone || '',
      notes: s.notes || '',
      has_engagements: s.engagements.length > 0,
      engagement_count: s.engagements.length,
      last_engagement: last ? dateFmt(last.date) : '',
      next_action: [...s.engagements].reverse().find(e => e.nextAction)?.nextAction || '',
      engagements: s.engagements.map(e => ({
        date: dateFmt(e.date),
        type: e.type,
        title: e.title,
        detail: e.description || '',
        outcome: e.outcome || '',
        next_action: e.nextAction || '',
      })),
    }
  })

  return {
    project_name: project?.name || '',
    export_date: dateFmt(new Date()),
    stakeholder_count: stakeholders.length,
    engagement_count: engagementTotal,
    stakeholders: rows,
  }
}

export async function buildFeedbackData(projectId: string) {
  const [project, pinCount, enquiryCount, forms, analysisRow] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    prisma.publicPin.count({ where: { projectId } }),
    prisma.enquiry.count({ where: { projectId } }),
    prisma.feedbackForm.findMany({ where: { projectId }, include: { _count: { select: { responses: true } } } }),
    prisma.analysisResult.findUnique({ where: { projectId_type: { projectId, type: 'full' } } }),
  ])
  const responseCount = forms.reduce((n, f) => n + f._count.responses, 0)

  type Analysis = {
    summary?: { executive?: string; keyFindings?: string[]; recommendations?: string[]; concernAreas?: string[]; supportAreas?: string[] }
    themes?: { themes?: Array<{ name: string; count: number; sentiment: string }> }
    headlineStats?: { stats?: Array<{ text: string }> }
    sentiment?: { breakdown?: { positive: number; negative: number; neutral: number } }
    analyzedAt?: string
    feedbackCount?: number
  }
  const analysis = (analysisRow?.status === 'complete' ? (analysisRow.data as Analysis) : null) || null
  const list = (items?: string[]) => (items || []).map(text => ({ text }))

  return {
    project_name: project?.name || '',
    export_date: dateFmt(new Date()),
    pin_count: pinCount,
    response_count: responseCount,
    enquiry_count: enquiryCount,
    total_feedback: pinCount + responseCount + enquiryCount,
    has_analysis: Boolean(analysis),
    analyzed_at: analysis?.analyzedAt ? dateFmt(new Date(analysis.analyzedAt)) : '',
    analyzed_count: analysis?.feedbackCount ?? '',
    executive_summary: analysis?.summary?.executive || '',
    key_findings: list(analysis?.summary?.keyFindings),
    recommendations: list(analysis?.summary?.recommendations),
    concern_areas: list(analysis?.summary?.concernAreas),
    support_areas: list(analysis?.summary?.supportAreas),
    headline_stats: (analysis?.headlineStats?.stats || []).map(s => ({ text: s.text })),
    themes: (analysis?.themes?.themes || []).map(t => ({ name: t.name, count: t.count, sentiment: t.sentiment })),
    positive_count: analysis?.sentiment?.breakdown?.positive ?? '',
    negative_count: analysis?.sentiment?.breakdown?.negative ?? '',
    neutral_count: analysis?.sentiment?.breakdown?.neutral ?? '',
  }
}

/** Sample data used to validate templates at upload time. */
export function sampleData(kind: TemplateKind): Record<string, unknown> {
  if (kind === 'stakeholders') {
    return {
      project_name: 'Sample Project', export_date: '1 January 2026',
      stakeholder_count: 1, engagement_count: 1,
      stakeholders: [{
        name: 'Sample Stakeholder', role: 'Role', organisation: 'Org', stance: 'neutral',
        influence: 3, interest: 3, email: '', phone: '', notes: '',
        has_engagements: true, engagement_count: 1, last_engagement: '1 January 2026', next_action: '',
        engagements: [{ date: '1 January 2026', type: 'call', title: 'Sample', detail: '', outcome: '', next_action: '' }],
      }],
    }
  }
  return {
    project_name: 'Sample Project', export_date: '1 January 2026',
    pin_count: 1, response_count: 1, enquiry_count: 1, total_feedback: 3,
    has_analysis: true, analyzed_at: '1 January 2026', analyzed_count: 3,
    executive_summary: 'Sample.', key_findings: [{ text: 'Sample' }], recommendations: [{ text: 'Sample' }],
    concern_areas: [{ text: 'Sample' }], support_areas: [{ text: 'Sample' }], headline_stats: [{ text: 'Sample' }],
    themes: [{ name: 'Sample', count: 1, sentiment: 'neutral' }],
    positive_count: 1, negative_count: 1, neutral_count: 1,
  }
}
