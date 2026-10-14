import { describe, it, expect } from 'vitest'
import { emailEventsForEnquiry, emailSnippet, organisationDomain } from './stakeholder-email-log'

const base = {
  id: 'enq1',
  channel: 'form',
  submitterEmail: 'Resident@Example.com',
  subject: 'Parking',
  message: 'Will there be parking?',
  createdAt: new Date('2026-10-01'),
}

describe('emailEventsForEnquiry', () => {
  it('turns the original submission and each message into events', () => {
    const events = emailEventsForEnquiry({
      ...base,
      messages: [
        { id: 'm1', direction: 'outbound', body: 'Yes', authorEmail: 'staff@x.com', cc: ['cllr@council.gov.uk'], bcc: ['pm@x.com'], createdAt: new Date('2026-10-02') },
        { id: 'm2', direction: 'inbound', body: 'Thanks', authorEmail: 'Cllr@Council.gov.uk', cc: [], bcc: [], createdAt: new Date('2026-10-03') },
      ],
    })
    expect(events.map(e => [e.key, e.direction, e.addresses])).toEqual([
      ['enq:enq1', 'inbound', ['resident@example.com']],
      ['msg:m1', 'outbound', ['resident@example.com', 'cllr@council.gov.uk', 'pm@x.com']],
      ['msg:m2', 'inbound', ['cllr@council.gov.uk']],
    ])
  })

  it('has no synthetic root for a thread the team started', () => {
    const events = emailEventsForEnquiry({
      ...base,
      channel: 'outbound',
      messages: [{ id: 'm1', direction: 'outbound', body: 'Hello', authorEmail: 'staff@x.com', cc: [], bcc: [], createdAt: new Date() }],
    })
    expect(events.map(e => e.key)).toEqual(['msg:m1'])
  })
})

describe('emailSnippet', () => {
  it('drops quoted history', () => {
    expect(emailSnippet('Sounds good.\n\nOn Mon, 1 Oct 2026, Jo wrote:\n> earlier')).toBe('Sounds good.')
    expect(emailSnippet('Agreed.\n> quoted')).toBe('Agreed.')
  })
  it('truncates long bodies', () => {
    const snippet = emailSnippet('a'.repeat(700))
    expect(snippet.length).toBe(601)
    expect(snippet.endsWith('…')).toBe(true)
  })
})

describe('organisationDomain', () => {
  it('returns organisational domains only', () => {
    expect(organisationDomain('jo@Ashford.gov.uk')).toBe('ashford.gov.uk')
    expect(organisationDomain('jo@gmail.com')).toBeNull()
    expect(organisationDomain('not-an-email')).toBeNull()
  })
})
