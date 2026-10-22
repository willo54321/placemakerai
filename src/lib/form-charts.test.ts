import { describe, it, expect } from 'vitest'
import { answerFor, applyFilters, buildFormCharts, chartFileName, describeFilters, filterQuestions, hasActiveFilters, type FormField } from './form-charts'

const fields: FormField[] = [
  { id: 1, type: 'radio', label: 'Overall view', options: ['Support', 'Neutral', 'Oppose'] },
  { id: 2, type: 'checkbox', label: 'Topics', options: ['Traffic', 'Wildlife', 'Views'] },
  { id: 3, type: 'rating', label: 'Information quality', options: [] },
  { id: 4, type: 'textarea', label: 'Comments', options: [] },
  { id: 5, type: 'number', label: 'Household size', options: [] },
]

const responses = [
  { data: { 1: 'Oppose', 2: ['Traffic', 'Views'], 3: 2, 4: 'Too big', 5: 2 } },
  { data: { 1: 'Oppose', 2: ['Traffic'], 3: 4, 5: 4 } },
  { data: { 1: 'Support', 2: [], 3: 5, 5: 1 } },
  { data: { 1: 'Something else', 3: 9 } },
]

describe('buildFormCharts', () => {
  const charts = buildFormCharts(fields, responses)

  it('charts structured questions only, titled with the question', () => {
    expect(charts.map(c => [c.title, c.kind])).toEqual([
      ['Overall view', 'single'], ['Topics', 'multiple'], ['Information quality', 'rating'], ['Household size', 'number'],
    ])
  })

  it('counts single choices in option order, with other answers after', () => {
    const view = charts[0]
    expect(view.respondents).toBe(4)
    expect(view.bars).toEqual([
      { label: 'Support', count: 1, percent: 25 },
      { label: 'Neutral', count: 0, percent: 0 },
      { label: 'Oppose', count: 2, percent: 50 },
      { label: 'Something else', count: 1, percent: 25 },
    ])
  })

  it('gives multiple-choice shares of the people who answered', () => {
    const topics = charts[1]
    expect(topics.respondents).toBe(2) // an empty selection is not an answer
    expect(topics.bars.find(b => b.label === 'Traffic')).toEqual({ label: 'Traffic', count: 2, percent: 100 })
  })

  it('distributes ratings 1–5, ignoring out-of-range scores, with an average', () => {
    const rating = charts[2]
    expect(rating.respondents).toBe(3)
    expect(rating.bars.map(b => b.count)).toEqual([0, 1, 0, 1, 1])
    expect(rating.average).toBe(3.7)
  })

  it('bins numbers', () => {
    const size = charts[3]
    expect(size.respondents).toBe(3)
    expect(size.bars.reduce((a, b) => a + b.count, 0)).toBe(3)
    expect(size.average).toBe(2.3)
  })
})

describe('answerFor', () => {
  it('finds answers from external forms keyed by label spellings', () => {
    const field = { type: 'radio', label: 'Overall view' }
    expect(answerFor({ overallView: 'Support' }, field)).toBe('Support')
    expect(answerFor({ overall_view: 'Oppose' }, field)).toBe('Oppose')
    expect(answerFor({ 'Overall view': 'Neutral' }, field)).toBe('Neutral')
  })
})

describe('chartFileName', () => {
  it('slugs the question title', () => {
    expect(chartFileName('Overall, what is your view of the proposals?')).toBe('overall-what-is-your-view-of-the-proposals.png')
  })
})

describe('filters', () => {
  const dated = [
    { data: { 1: 'Oppose', 2: ['Traffic', 'Views'], 3: 2 }, submittedAt: '2026-10-01T09:00:00' },
    { data: { 1: 'Oppose', 2: ['Traffic'], 3: 4 }, submittedAt: '2026-10-05T18:30:00' },
    { data: { 1: 'Support', 2: [], 3: 5 }, submittedAt: '2026-10-10T12:00:00' },
  ]

  it('lists filterable questions with their options first', () => {
    const qs = filterQuestions(fields, dated)
    expect(qs.map(q => q.title)).toEqual(['Overall view', 'Topics', 'Information quality'])
    expect(qs[0].values).toEqual(['Support', 'Neutral', 'Oppose'])
    expect(qs[2].values).toEqual(['1', '2', '3', '4', '5'])
  })

  it('filters by inclusive date range', () => {
    expect(applyFilters(fields, dated, { from: '2026-10-05', to: '2026-10-05', answers: {} })).toHaveLength(1)
    expect(applyFilters(fields, dated, { to: '2026-10-05', answers: {} })).toHaveLength(2)
  })

  it('ORs answers within a question and ANDs across questions', () => {
    expect(applyFilters(fields, dated, { answers: { 1: ['Oppose', 'Support'] } })).toHaveLength(3)
    expect(applyFilters(fields, dated, { answers: { 1: ['Oppose'], 2: ['Views'] } })).toHaveLength(1)
    expect(applyFilters(fields, dated, { answers: { 3: ['4', '5'] } })).toHaveLength(2)
  })

  it('describes active filters for exported charts', () => {
    const qs = filterQuestions(fields, dated)
    expect(describeFilters({ answers: {} }, qs)).toBeNull()
    expect(hasActiveFilters({ answers: { 1: [] } })).toBe(false)
    expect(describeFilters({ from: '2026-10-01', answers: { 1: ['Oppose'] } }, qs)).toBe('Filtered — from 1 Oct 2026; Overall view: Oppose')
    expect(describeFilters({ answers: { a: ['Freckenham'] } }, [{ key: 'a', title: 'Where do you live?', values: [] }])).toBe('Filtered — Where do you live? Freckenham')
  })
})

describe('matrix and specify questions', () => {
  const grid: FormField[] = [
    { id: 'green', type: 'matrix', label: 'Green spaces', rows: ['Buffer', 'Play area'], options: ['Support', 'Oppose'] },
    { id: 'homes', type: 'checkbox', label: 'Homes', options: ['Flats', 'Other – please specify'], specify: ['Other – please specify'] },
    { id: 'about', type: 'heading', label: 'About you' },
  ]
  const rows = [
    { data: { 'green:0': 'Support', 'green:1': 'Oppose', homes: ['Other – please specify'], 'homes:specify:1': 'Bungalows' }, submittedAt: '2026-10-01T10:00:00Z' },
    { data: { 'green:0': 'Support', homes: ['Flats'] }, submittedAt: '2026-10-02T10:00:00Z' },
  ]

  it('charts each matrix row as a single-choice question', () => {
    const charts = buildFormCharts(grid, rows)
    expect(charts.map(c => [c.title, c.kind, c.respondents])).toEqual([
      ['Green spaces — Buffer', 'single', 2], ['Green spaces — Play area', 'single', 1], ['Homes', 'multiple', 2],
    ])
    expect(charts[0].bars).toEqual([{ label: 'Support', count: 2, percent: 100 }, { label: 'Oppose', count: 0, percent: 0 }])
  })

  it('filters by a matrix row', () => {
    const questions = filterQuestions(grid, rows)
    expect(questions.map(q => q.key)).toEqual(['green:0', 'green:1', 'homes'])
    expect(applyFilters(grid, rows, { answers: { 'green:1': ['Oppose'] } })).toHaveLength(1)
  })
})
