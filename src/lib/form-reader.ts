// Reads a paper/printed feedback form with Claude (vision) and turns it into an
// online form: a name plus the fields the public form builder understands. The
// admin reviews the result in the builder before it is saved — nothing here
// writes to the database.
import { FIELD_TYPES, type FormFieldDef } from './form-fields'

const MODEL = 'claude-opus-5-5'

const FIELD_VALUES = FIELD_TYPES.map(t => t.value)

/** A field as Claude returns it: every key present, empty arrays/null where unused. */
export interface ReadFormField {
  type: string
  label: string
  required: boolean
  description: string | null
  options: string[]
  rows: string[]
  specify: string[]
}

export interface FormReading {
  name: string
  fields: ReadFormField[]
}

/** The media types Claude can read directly — common photo/scan formats plus PDF. */
export type FormImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })
const stringArray = { type: 'array', items: { type: 'string' } }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'fields'],
  properties: {
    name: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label', 'required', 'description', 'options', 'rows', 'specify'],
        properties: {
          type: { type: 'string', enum: FIELD_VALUES },
          label: { type: 'string' },
          required: { type: 'boolean' },
          description: nullable({ type: 'string' }),
          options: stringArray,
          rows: stringArray,
          specify: stringArray,
        },
      },
    },
  },
}

const SYSTEM = `You convert a paper or printed feedback form into an online form so it can be filled in on the web. You are given an image or PDF of the blank form. Return the form's name and every question on it, in the order they appear, each mapped to the closest online field type.

name: the form's printed title, or a short descriptive name if it has none.

Field types, and when to use each:
- text: a short written answer (name, postcode, a single line).
- textarea: a long written answer (comments, "please explain", a box spanning several lines).
- email: an email-address field.
- number: a numeric field (age, how many, a reference number).
- select / radio: pick ONE option. Use radio when the paper shows tick boxes or circles to choose between a few options; select is interchangeable — prefer radio for 2–6 options.
- checkbox: pick ANY NUMBER of options (tick all that apply).
- matrix: a grid where several items are each rated on the SAME scale (e.g. rows of statements against columns Strongly agree … Strongly disagree). Put the row labels in "rows" and the column choices in "options".
- rating: a single 1–5 (or similar) satisfaction/agreement scale for one thing.
- subscribe: a mailing-list / "keep me updated" opt-in. Put the consent wording as the single entry in "options".
- heading: a section title or a block of instructions/introductory text that collects no answer. Put any body text in "description".

For every field:
- label: the question's exact wording.
- required: true only where the form marks it as required (an asterisk, "required", "must").
- description: any hint or help text printed under the question, else null.
- options: the printed choices, verbatim, for select/radio/checkbox/matrix (and the consent wording for subscribe); otherwise an empty array.
- rows: the row labels for a matrix; otherwise an empty array.
- specify: options that ask the reader to write more, such as "Other (please specify)" — copy them verbatim and they must also appear in options. Otherwise an empty array.

Do not invent questions, and do not add a general data-protection / GDPR consent tick box — the platform adds its own. Skip page furniture: office-use-only boxes, return addresses, barcodes, page numbers.`

export async function readFormSheet(image: { base64: string; mediaType: FormImageMediaType }): Promise<FormReading> {
  // Imported lazily so the pure helpers below stay loadable without the AI SDK.
  const { getAnthropic } = await import('./ai')
  const block =
    image.mediaType === 'application/pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: image.base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.base64 } }

  const response = await getAnthropic().beta.messages.create({
    model: MODEL,
    // If a safeguard declines, the API re-runs the request on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_tokens: 8000,
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    system: SYSTEM,
    messages: [{ role: 'user', content: [block, { type: 'text', text: 'Read this feedback form and convert it to an online form.' }] }],
  })
  if (response.stop_reason === 'refusal') throw new Error('The form could not be read')
  const text = response.content.find(b => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error(`No reading returned (stop_reason: ${response.stop_reason})`)
  return JSON.parse(text.text) as FormReading
}

/**
 * The reader's fields as the form builder's state wants them: numeric ids,
 * arrays always present, and subscribe/heading kept intact. Drops any field
 * whose type isn't one the builder knows.
 */
export function toBuilderFields(reading: FormReading): Array<FormFieldDef & { id: number }> {
  return reading.fields
    .filter(f => FIELD_VALUES.includes(f.type))
    .map((f, i) => ({
      id: Date.now() + i,
      type: f.type,
      label: f.label,
      required: Boolean(f.required),
      description: f.description ?? '',
      options: Array.isArray(f.options) ? f.options : [],
      rows: Array.isArray(f.rows) ? f.rows : [],
      specify: Array.isArray(f.specify) ? f.specify : [],
    }))
}
