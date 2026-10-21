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
    const key = field.id != null ? String(field.id) : `field-${index}`
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
