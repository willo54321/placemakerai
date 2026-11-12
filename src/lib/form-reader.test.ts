import { describe, it, expect } from 'vitest'
import { toBuilderFields, type FormReading } from './form-reader'

const reading = (fields: FormReading['fields']): FormReading => ({ name: 'Elm Park survey', fields })

describe('toBuilderFields', () => {
  it('maps a read field to the builder shape with defaults filled in', () => {
    const [field] = toBuilderFields(
      reading([{ type: 'text', label: 'Your name', required: true, description: null, options: [], rows: [], specify: [] }]),
    )
    expect(field).toMatchObject({
      type: 'text',
      label: 'Your name',
      required: true,
      description: '',
      options: [],
      rows: [],
      specify: [],
    })
    expect(typeof field.id).toBe('number')
  })

  it('keeps choice options, matrix rows and specify entries', () => {
    const [field] = toBuilderFields(
      reading([
        {
          type: 'matrix',
          label: 'Rate each proposal',
          required: false,
          description: 'One per row',
          options: ['Agree', 'Disagree'],
          rows: ['Housing', 'Green space'],
          specify: [],
        },
      ]),
    )
    expect(field.options).toEqual(['Agree', 'Disagree'])
    expect(field.rows).toEqual(['Housing', 'Green space'])
    expect(field.description).toBe('One per row')
  })

  it('gives every field a distinct id', () => {
    const fields = toBuilderFields(
      reading([
        { type: 'text', label: 'A', required: false, description: null, options: [], rows: [], specify: [] },
        { type: 'email', label: 'B', required: false, description: null, options: [], rows: [], specify: [] },
      ]),
    )
    expect(new Set(fields.map(f => f.id)).size).toBe(2)
  })

  it('drops fields whose type the builder does not know', () => {
    const fields = toBuilderFields(
      reading([
        { type: 'signature', label: 'Sign here', required: false, description: null, options: [], rows: [], specify: [] },
        { type: 'radio', label: 'Support?', required: false, description: null, options: ['Yes', 'No'], rows: [], specify: [] },
      ]),
    )
    expect(fields.map(f => f.type)).toEqual(['radio'])
  })
})
