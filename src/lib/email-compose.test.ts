import { describe, it, expect } from 'vitest'
import { parseEmailList, parseCopiedRecipients, withSignature } from './email-compose'

describe('parseEmailList', () => {
  it('splits on commas, semicolons and newlines, lower-cases and dedupes', () => {
    expect(parseEmailList('A@x.com, b@y.org; a@x.com\nc@z.io')).toEqual({
      emails: ['a@x.com', 'b@y.org', 'c@z.io'],
      invalid: [],
    })
  })
  it('accepts "Name <addr>" entries and arrays', () => {
    expect(parseEmailList(['Jo Bloggs <jo@x.com>', ' ']).emails).toEqual(['jo@x.com'])
  })
  it('reports invalid entries', () => {
    expect(parseEmailList('ok@x.com, nope').invalid).toEqual(['nope'])
  })
  it('treats missing input as empty', () => {
    expect(parseEmailList(undefined)).toEqual({ emails: [], invalid: [] })
  })
})

describe('parseCopiedRecipients', () => {
  it('drops the To address and CC duplicates from BCC', () => {
    expect(parseCopiedRecipients({ cc: 'to@x.com, cc@x.com', bcc: 'cc@x.com, b@x.com' }, 'TO@x.com')).toEqual({
      cc: ['cc@x.com'],
      bcc: ['b@x.com'],
    })
  })
  it('errors on invalid addresses', () => {
    expect(parseCopiedRecipients({ cc: 'bad' }, 'to@x.com').error).toMatch(/Invalid email address: bad/)
  })
  it('caps the number of copied recipients', () => {
    const many = Array.from({ length: 21 }, (_, i) => `p${i}@x.com`).join(',')
    expect(parseCopiedRecipients({ bcc: many }, 'to@x.com').error).toMatch(/Too many/)
  })
})

describe('withSignature', () => {
  it('appends the signature after a blank line', () => {
    expect(withSignature('Hello', 'Sam\nPlacemaker')).toBe('Hello\n\nSam\nPlacemaker')
  })
  it('leaves the body alone without a signature', () => {
    expect(withSignature('Hello', '  ')).toBe('Hello')
    expect(withSignature('Hello', null)).toBe('Hello')
  })
})
