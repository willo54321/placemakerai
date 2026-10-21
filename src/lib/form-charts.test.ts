import { describe, it, expect } from 'vitest'
import { answerFor, buildFormCharts, chartFileName, type FormField } from './form-charts'

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
