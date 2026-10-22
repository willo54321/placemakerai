// Feedback-form field definitions and how they expand into the answers a
// response actually holds. Response data is a flat map of answer key → value;
// most fields are one answer, but a matrix question is one answer per row and
// an option that asks for details ("Other – please specify") adds a text
// answer alongside the choice. Headings collect nothing.

export interface FormFieldDef {
  id?: string | number
  type: string
  label: string
  /** Help text shown under the label (or under a heading). */
  description?: string
  required?: boolean
  options?: string[]
  /** Matrix only: one single-choice question per row, all sharing `options`. */
  rows?: string[]
  /** Radio/checkbox: options that open a text box for details when chosen. */
  specify?: string[]
}

/** Field types that render as an input and are shown in the builder. */
export const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'matrix', label: 'Grid (one choice per row)' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'subscribe', label: 'Mailing list opt-in' },
  { value: 'heading', label: 'Section heading / text' },
]

export const CHOICE_TYPES = ['select', 'radio', 'checkbox']

export const fieldKey = (field: FormFieldDef, index?: number): string =>
  field.id != null ? String(field.id) : index != null ? `field-${index}` : field.label

export const matrixRowKey = (field: FormFieldDef, rowIndex: number) => `${fieldKey(field)}:${rowIndex}`
export const specifyKey = (field: FormFieldDef, option: string) =>
  `${fieldKey(field)}:specify:${(field.options ?? []).indexOf(option)}`

/**
 * The answers a form collects, one entry per response key. Matrix rows become
 * single-choice questions titled "Question — Row"; "specify" options add a
 * text question titled "Question — Option"; headings are dropped. Every
 * other field passes through unchanged.
 */
export function answerFields<F extends FormFieldDef>(fields: F[]): Array<F | FormFieldDef> {
  const out: Array<F | FormFieldDef> = []
  for (const field of fields ?? []) {
    if (field.type === 'heading') continue
    if (field.type === 'matrix') {
      ;(field.rows ?? []).forEach((row, i) => {
        out.push({ id: matrixRowKey(field, i), type: 'radio', label: `${field.label} — ${row}`, options: field.options ?? [] })
      })
      continue
    }
    out.push(field)
    for (const option of field.specify ?? []) {
      if (!(field.options ?? []).includes(option)) continue
      out.push({ id: specifyKey(field, option), type: 'text', label: `${field.label} — ${option}` })
    }
  }
  return out
}
