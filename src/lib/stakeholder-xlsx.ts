import ExcelJS from 'exceljs'

/**
 * Styled Excel export of the stakeholder tracker. Three sheets, following the
 * standard stakeholder-register conventions:
 *
 * - Register: one row per stakeholder with ratings and the computed
 *   power/interest quadrant (same labels as the matrix tab).
 * - Engagement log: one row per engagement, chronological, real date cells.
 * - Summary: headline counts and breakdowns by stance, type and quadrant.
 */

type StakeholderWithEngagements = {
  name: string
  email: string | null
  phone: string | null
  organization: string | null
  role: string | null
  category: string
  notes: string | null
  influence: number | null
  interest: number | null
  type: string
  engagements: Array<{
    type: string
    title: string
    description: string | null
    date: Date
    outcome: string | null
    nextAction: string | null
  }>
}

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF0F172A' },
}
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' } }

const STANCE_FILLS: Record<string, string> = {
  supporter: 'FFDCFCE7',
  opposed: 'FFFEE2E2',
  undecided: 'FFFEF3C7',
  neutral: 'FFF1F5F9',
}

const DATE_FORMAT = 'dd mmm yyyy'

const cap = (value: string | null | undefined) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : ''

/** Power/interest quadrant, matching the matrix tab's labels. 4–5 is high. */
function quadrant(influence: number | null, interest: number | null): string {
  if (!influence || !interest) return 'Unrated'
  const highInfluence = influence > 3
  const highInterest = interest > 3
  if (highInfluence && highInterest) return 'Manage closely'
  if (highInfluence) return 'Keep satisfied'
  if (highInterest) return 'Keep informed'
  return 'Monitor'
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, columnCount: number) {
  const header = sheet.getRow(1)
  header.font = HEADER_FONT
  header.fill = HEADER_FILL
  header.alignment = { vertical: 'middle' }
  header.height = 20
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columnCount },
  }
}

export async function buildStakeholderWorkbook(
  projectName: string,
  stakeholders: StakeholderWithEngagements[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Placemaker'
  workbook.created = new Date()

  // ---- Register -------------------------------------------------------------
  const register = workbook.addWorksheet('Register')
  register.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Role', key: 'role', width: 24 },
    { header: 'Organisation', key: 'org', width: 26 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Stance', key: 'stance', width: 12 },
    { header: 'Influence', key: 'influence', width: 10 },
    { header: 'Interest', key: 'interest', width: 10 },
    { header: 'Priority', key: 'priority', width: 16 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Engagements', key: 'count', width: 12 },
    { header: 'Last engagement', key: 'last', width: 16 },
    { header: 'Next action', key: 'next', width: 36 },
    { header: 'Notes', key: 'notes', width: 48 },
  ]

  for (const s of stakeholders) {
    const dated = [...s.engagements].sort((a, b) => a.date.getTime() - b.date.getTime())
    const last = dated[dated.length - 1]
    const nextAction = [...dated].reverse().find(e => e.nextAction?.trim())?.nextAction ?? ''

    const row = register.addRow({
      name: s.name,
      role: s.role ?? '',
      org: s.organization ?? '',
      type: cap(s.type),
      stance: cap(s.category),
      influence: s.influence ?? '',
      interest: s.interest ?? '',
      priority: quadrant(s.influence, s.interest),
      email: s.email ?? '',
      phone: s.phone ?? '',
      count: s.engagements.length,
      last: last ? last.date : '',
      next: nextAction,
      notes: s.notes ?? '',
    })

    const stanceFill = STANCE_FILLS[s.category]
    if (stanceFill) {
      row.getCell('stance').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: stanceFill },
      }
    }
    if (last) row.getCell('last').numFmt = DATE_FORMAT
    row.getCell('next').alignment = { wrapText: true, vertical: 'top' }
    row.getCell('notes').alignment = { wrapText: true, vertical: 'top' }
  }
  styleHeaderRow(register, register.columns.length)

  // ---- Engagement log -------------------------------------------------------
  const log = workbook.addWorksheet('Engagement log')
  log.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Stakeholder', key: 'name', width: 24 },
    { header: 'Organisation', key: 'org', width: 26 },
    { header: 'Type', key: 'type', width: 12 },
    { header: 'Engagement', key: 'title', width: 34 },
    { header: 'Detail', key: 'detail', width: 48 },
    { header: 'Outcome', key: 'outcome', width: 36 },
    { header: 'Next action', key: 'next', width: 36 },
  ]

  const allEngagements = stakeholders
    .flatMap(s => s.engagements.map(e => ({ s, e })))
    .sort((a, b) => a.e.date.getTime() - b.e.date.getTime())

  for (const { s, e } of allEngagements) {
    const row = log.addRow({
      date: e.date,
      name: s.name,
      org: s.organization ?? '',
      type: cap(e.type),
      title: e.title,
      detail: e.description ?? '',
      outcome: e.outcome ?? '',
      next: e.nextAction ?? '',
    })
    row.getCell('date').numFmt = DATE_FORMAT
    for (const key of ['detail', 'outcome', 'next']) {
      row.getCell(key).alignment = { wrapText: true, vertical: 'top' }
    }
  }
  styleHeaderRow(log, log.columns.length)

  // ---- Summary --------------------------------------------------------------
  const summary = workbook.addWorksheet('Summary')
  summary.getColumn(1).width = 26
  summary.getColumn(2).width = 12

  const title = summary.addRow([projectName])
  title.font = { bold: true, size: 14 }
  summary.addRow([])
  summary.addRow(['Stakeholders', stakeholders.length])
  summary.addRow(['Engagements', allEngagements.length])
  if (allEngagements.length > 0) {
    const lastRow = summary.addRow([
      'Last engagement',
      allEngagements[allEngagements.length - 1].e.date,
    ])
    lastRow.getCell(2).numFmt = DATE_FORMAT
    lastRow.getCell(2).alignment = { horizontal: 'left' }
  }

  const tally = (values: string[]) => {
    const counts = new Map<string, number>()
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }
  const addBreakdown = (heading: string, entries: Array<[string, number]>) => {
    summary.addRow([])
    const head = summary.addRow([heading])
    head.font = { bold: true }
    for (const [label, count] of entries) summary.addRow([label, count])
  }

  addBreakdown('By stance', tally(stakeholders.map(s => cap(s.category))))
  addBreakdown('By type', tally(stakeholders.map(s => cap(s.type))))
  addBreakdown('By priority', tally(stakeholders.map(s => quadrant(s.influence, s.interest))))
  addBreakdown('Engagements by type', tally(allEngagements.map(({ e }) => cap(e.type))))

  return Buffer.from(await workbook.xlsx.writeBuffer())
}
