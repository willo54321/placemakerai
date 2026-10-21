// Turns a feedback form's questions and responses into one chart per
// question that has structured answers: single choice (radio/select),
// multiple choice (checkbox), 1–5 rating and number. Free-text questions
// have no chart — they go to AI analysis instead.

export interface FormField {
  id?: string | number
  type: string
  label: string
  options?: string[]
}

export interface ChartBar {
  label: string
  count: number
  /** Share of the people who answered this question, 0–100. */
  percent: number
}

export interface FormChart {
  key: string
  title: string
  kind: 'single' | 'multiple' | 'rating' | 'number'
  /** People who answered this question. */
  respondents: number
  bars: ChartBar[]
  /** Mean score, for ratings and numbers. */
  average?: number
}

const camel = (s: string) => s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, c => c.toLowerCase())
const snake = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

/** The answer to a field: keyed by id for Placemaker forms, by label (in common spellings) for external ones. */
export function answerFor(data: Record<string, unknown>, field: FormField): unknown {
  const keys = [field.id != null ? String(field.id) : null, field.label, camel(field.label), snake(field.label)]
  for (const key of keys) {
    if (key != null && key in data) return data[key]
  }
  return undefined
}

const isBlank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 1000) / 10 : 0)

/** Count each value, keeping the form's option order first and any other answers after. */
function tally(values: string[], options: string[] | undefined, respondents: number): ChartBar[] {
  const counts = new Map<string, number>()
  for (const o of options ?? []) counts.set(o, 0)
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return Array.from(counts, ([label, count]) => ({ label, count, percent: pct(count, respondents) }))
}

export function buildFormCharts(fields: FormField[], responses: Array<{ data: Record<string, unknown> }>): FormChart[] {
  const charts: FormChart[] = []
  fields.forEach((field, index) => {
    const answers = responses.map(r => answerFor(r.data ?? {}, field)).filter(v => !isBlank(v))
    const key = fieldKeyOf(field, index)
    const base = { key, title: field.label || `Question ${index + 1}`, respondents: answers.length }

    if (field.type === 'radio' || field.type === 'select') {
      charts.push({ ...base, kind: 'single', bars: tally(answers.map(String), field.options, answers.length) })
    } else if (field.type === 'checkbox') {
      const chosen = answers.flatMap(v => (Array.isArray(v) ? v.map(String) : [String(v)]))
      charts.push({ ...base, kind: 'multiple', bars: tally(chosen, field.options, answers.length) })
    } else if (field.type === 'rating') {
      const scores = answers.map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= 5).map(Math.round)
      const bars = [1, 2, 3, 4, 5].map(n => {
        const count = scores.filter(s => s === n).length
        return { label: String(n), count, percent: pct(count, scores.length) }
      })
      const average = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : undefined
      charts.push({ ...base, respondents: scores.length, kind: 'rating', bars, average })
    } else if (field.type === 'number') {
      const nums = answers.map(Number).filter(Number.isFinite)
      if (nums.length === 0) return
      const min = Math.min(...nums), max = Math.max(...nums)
      const binCount = Math.min(6, new Set(nums).size)
      const width = binCount > 1 ? (max - min) / binCount : 1
      const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
      const bars = Array.from({ length: binCount }, (_, b) => {
        const lo = min + b * width, hi = b === binCount - 1 ? max : lo + width
        const count = nums.filter(n => n >= lo && (b === binCount - 1 ? n <= hi : n < hi)).length
        return { label: binCount === 1 ? fmt(min) : `${fmt(lo)}–${fmt(hi)}`, count, percent: pct(count, nums.length) }
      })
      const average = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
      charts.push({ ...base, respondents: nums.length, kind: 'number', bars, average })
    }
  })
  return charts.filter(c => c.respondents > 0)
}

/** A safe file name from a question title. */
export function chartFileName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return `${slug || 'chart'}.png`
}

// ---- filters ---------------------------------------------------------------

/** Field types that can be filtered (and charted) by answer. */
const FILTERABLE = new Set(['radio', 'select', 'checkbox', 'rating'])

/** Stable key for a field: its id, or its position for fields without one. */
export function fieldKeyOf(field: FormField, index: number): string {
  return field.id != null ? String(field.id) : `field-${index}`
}

export interface FilterQuestion {
  key: string
  title: string
  /** Answer values in display order: the form's options, then any others given. */
  values: string[]
}

/** An answer as the list of filterable values it contains. */
function answerValues(field: FormField, raw: unknown): string[] {
  if (isBlank(raw)) return []
  if (field.type === 'rating') {
    const n = Math.round(Number(raw))
    return Number.isFinite(n) && n >= 1 && n <= 5 ? [String(n)] : []
  }
  return Array.isArray(raw) ? raw.map(String) : [String(raw)]
}

export function filterQuestions(fields: FormField[], responses: Array<{ data: Record<string, unknown> }>): FilterQuestion[] {
  return fields.flatMap((field, index) => {
    if (!FILTERABLE.has(field.type)) return []
    const seen = new Set(field.type === 'rating' ? ['1', '2', '3', '4', '5'] : field.options ?? [])
    for (const r of responses) for (const v of answerValues(field, answerFor(r.data ?? {}, field))) seen.add(v)
    if (seen.size === 0) return []
    return [{ key: fieldKeyOf(field, index), title: field.label || `Question ${index + 1}`, values: Array.from(seen) }]
  })
}

export interface ResponseFilters {
  /** Inclusive dates, YYYY-MM-DD in local time. */
  from?: string
  to?: string
  /** Question key → accepted answers. Any accepted answer matches; questions combine with AND. */
  answers: Record<string, string[]>
}

export function hasActiveFilters(filters: ResponseFilters): boolean {
  return Boolean(filters.from || filters.to || Object.values(filters.answers).some(v => v.length > 0))
}

export function applyFilters<R extends { data: Record<string, unknown>; submittedAt: string | Date }>(
  fields: FormField[], responses: R[], filters: ResponseFilters,
): R[] {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Infinity
  const active = fields
    .map((field, index) => ({ field, accepted: filters.answers[fieldKeyOf(field, index)] ?? [] }))
    .filter(f => f.accepted.length > 0)
  return responses.filter(r => {
    const t = new Date(r.submittedAt).getTime()
    if (t < from || t > to) return false
    return active.every(({ field, accepted }) =>
      answerValues(field, answerFor(r.data ?? {}, field)).some(v => accepted.includes(v)))
  })
}

/** One line describing active filters, for chart subtitles and exported PNGs. */
export function describeFilters(filters: ResponseFilters, questions: FilterQuestion[]): string | null {
  const parts: string[] = []
  const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  if (filters.from && filters.to) parts.push(`${day(filters.from)} – ${day(filters.to)}`)
  else if (filters.from) parts.push(`from ${day(filters.from)}`)
  else if (filters.to) parts.push(`up to ${day(filters.to)}`)
  for (const q of questions) {
    const accepted = filters.answers[q.key] ?? []
    // "Where do you live? Freckenham", "Overall view: Oppose"
    if (accepted.length) parts.push(`${q.title}${/[?:]$/.test(q.title.trim()) ? '' : ':'} ${accepted.join(' or ')}`)
  }
  return parts.length ? `Filtered — ${parts.join('; ')}` : null
}
