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
        { id: 'm1', direction: 'outbound', body: 'Yes', authorEmail: 'staff@x.com', to: [], cc: ['cllr@council.gov.uk'], bcc: ['pm@x.com'], createdAt: new Date('2026-10-02') },
        { id: 'm2', direction: 'inbound', body: 'Thanks', authorEmail: 'Cllr@Council.gov.uk', to: [], cc: [], bcc: [], createdAt: new Date('2026-10-03') },
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
      messages: [{ id: 'm1', direction: 'outbound', body: 'Hello', authorEmail: 'staff@x.com', to: [], cc: [], bcc: [], createdAt: new Date() }],
    })
    expect(events.map(e => e.key)).toEqual(['msg:m1'])
  })

  it('logs copied correspondence against everyone on it', () => {
    const events = emailEventsForEnquiry({
      ...base,
      channel: 'copied',
      submitterEmail: 'cllr@council.gov.uk',
      messages: [
        // A team member's own email, copied to the project address.
        { id: 'm1', direction: 'outbound', body: 'Briefing', authorEmail: 'staff@x.com', to: ['cllr@council.gov.uk', 'clerk@parish.org'], cc: ['resident@example.com'], bcc: [], createdAt: new Date() },
        // A reply-all: the other people on it are logged as well as its author.
        { id: 'm2', direction: 'inbound', body: 'Thanks', authorEmail: 'clerk@parish.org', to: ['cllr@council.gov.uk'], cc: ['resident@example.com'], bcc: [], createdAt: new Date() },
      ],
    })
    expect(events.map(e => [e.key, e.direction, e.addresses])).toEqual([
      ['msg:m1', 'outbound', ['cllr@council.gov.uk', 'clerk@parish.org', 'resident@example.com']],
      ['msg:m2', 'inbound', ['clerk@parish.org', 'cllr@council.gov.uk', 'resident@example.com']],
    ])
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
