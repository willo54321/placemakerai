import { describe, it, expect } from 'vitest'
import { answerFields, matrixRowKey, specifyKey, type FormFieldDef } from './form-fields'

const fields: FormFieldDef[] = [
  { id: 'intro', type: 'heading', label: 'About you', description: 'Optional' },
  { id: 'green', type: 'matrix', label: 'Green spaces', rows: ['Buffer', 'Play area'], options: ['Support', 'Oppose'] },
  { id: 'homes', type: 'checkbox', label: 'Homes needed', options: ['Flats', 'Other – please specify'], specify: ['Other – please specify', 'Not an option'] },
  { id: 'comments', type: 'textarea', label: 'Comments' },
]

describe('answerFields', () => {
  const answers = answerFields(fields)

  it('drops headings, expands matrix rows and specify boxes, keeps the rest', () => {
    expect(answers.map(f => [f.id, f.type, f.label])).toEqual([
      ['green:0', 'radio', 'Green spaces — Buffer'],
      ['green:1', 'radio', 'Green spaces — Play area'],
      ['homes', 'checkbox', 'Homes needed'],
      ['homes:specify:1', 'text', 'Homes needed — Other – please specify'],
      ['comments', 'textarea', 'Comments'],
    ])
  })

  it('matrix rows share the question options', () => {
    expect(answers[0].options).toEqual(['Support', 'Oppose'])
  })

  it('keys match what the public form stores', () => {
    expect(matrixRowKey(fields[1], 1)).toBe('green:1')
    expect(specifyKey(fields[2], 'Other – please specify')).toBe('homes:specify:1')
  })
})
