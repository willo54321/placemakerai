import { describe, it, expect } from 'vitest'
import {
  addressesProject, classifyNewThread, externalRecipients, normaliseMessageId, parseMailbox, referencedMessageIds,
} from './inbound-email'

const DOMAIN = 'placemakerai.io'
const team = new Set(['officer@developer.co.uk'])

describe('parseMailbox', () => {
  it('splits display name and address', () => {
    expect(parseMailbox('"Jo Bloggs" <Jo@Example.com>')).toEqual({ name: 'Jo Bloggs', email: 'jo@example.com' })
    expect(parseMailbox('jo@example.com')).toEqual({ name: null, email: 'jo@example.com' })
  })
})

describe('externalRecipients', () => {
  it('drops our own addresses, the team and duplicates', () => {
    const list = [
      'Cllr Smith <cllr@council.gov.uk>',
      'magnapark+e-abc@placemakerai.io',
      'otherproject@placemakerai.io',
      'Officer <officer@developer.co.uk>',
      'CLLR@council.gov.uk',
      'sender@example.com',
    ]
    expect(externalRecipients(list, DOMAIN, team, ['sender@example.com'])).toEqual([
      { name: 'Cllr Smith', email: 'cllr@council.gov.uk' },
    ])
  })
})

describe('addressesProject', () => {
  it('matches the project address with or without a tag', () => {
    expect(addressesProject(['Magna Park <magnapark@placemakerai.io>'], DOMAIN, 'magnapark')).toBe(true)
    expect(addressesProject(['magnapark+c-1@placemakerai.io'], DOMAIN, 'magnapark')).toBe(true)
    expect(addressesProject(['officer@developer.co.uk'], DOMAIN, 'magnapark')).toBe(false)
    expect(addressesProject(null, DOMAIN, 'magnapark')).toBe(false)
  })
})

describe('referencedMessageIds', () => {
  it('collects ids from In-Reply-To and References, case-insensitively', () => {
    expect(referencedMessageIds({
      'In-Reply-To': '<b@mail.x>',
      references: '<a@mail.x> <b@mail.x>',
      Subject: '<not@an.id>',
    })).toEqual(['<b@mail.x>', '<a@mail.x>'])
    expect(referencedMessageIds(null)).toEqual([])
  })
})

describe('normaliseMessageId', () => {
  it('brackets bare ids', () => {
    expect(normaliseMessageId('abc@mail.x')).toBe('<abc@mail.x>')
    expect(normaliseMessageId('<abc@mail.x>')).toBe('<abc@mail.x>')
    expect(normaliseMessageId(' ')).toBeNull()
  })
})

describe('classifyNewThread', () => {
  const cllr = { name: 'Cllr Smith', email: 'cllr@council.gov.uk' }
  const resident = { name: null, email: 'resident@example.com' }
  const officer = { name: 'Officer', email: 'officer@developer.co.uk' }

  it('treats a team member copying the project in as their own outbound email', () => {
    expect(classifyNewThread({ sender: officer, senderIsTeam: true, projectInTo: false, to: [cllr], cc: [resident] }))
      .toEqual({ kind: 'copied', direction: 'outbound', correspondent: cllr })
    // Recipient only on CC (project in To) still counts.
    expect(classifyNewThread({ sender: officer, senderIsTeam: true, projectInTo: true, to: [], cc: [cllr] }))
      .toEqual({ kind: 'copied', direction: 'outbound', correspondent: cllr })
  })

  it('keeps a team member forwarding something in as an enquiry', () => {
    expect(classifyNewThread({ sender: officer, senderIsTeam: true, projectInTo: true, to: [], cc: [] }))
      .toEqual({ kind: 'enquiry' })
  })

  it('treats outside mail the project was only copied on as an inbound copy', () => {
    expect(classifyNewThread({ sender: cllr, senderIsTeam: false, projectInTo: false, to: [], cc: [] }))
      .toEqual({ kind: 'copied', direction: 'inbound', correspondent: cllr })
  })

  it('treats mail sent to the project as an enquiry', () => {
    expect(classifyNewThread({ sender: resident, senderIsTeam: false, projectInTo: true, to: [], cc: [cllr] }))
      .toEqual({ kind: 'enquiry' })
  })
})
