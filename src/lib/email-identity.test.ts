import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import {
  deriveEmailLocalPart,
  isValidEmailLocalPart,
  getSenderDomain,
  parseInboundAddress,
} from './email-identity'
import { verifySvixSignature } from './webhook-verify'

describe('deriveEmailLocalPart', () => {
  it('collapses a project name to a bare local part', () => {
    expect(deriveEmailLocalPart('Magna Park Corby')).toBe('magnaparkcorby')
  })
  it('strips diacritics and punctuation', () => {
    expect(deriveEmailLocalPart('Église St-Denis (Phase 2)')).toBe('eglisestdenisphase2')
  })
  it('returns null when nothing usable remains', () => {
    expect(deriveEmailLocalPart('!!!')).toBeNull()
    expect(deriveEmailLocalPart('')).toBeNull()
  })
})

describe('isValidEmailLocalPart', () => {
  it('accepts lowercase alphanumerics and interior hyphens', () => {
    expect(isValidEmailLocalPart('magna-park')).toBe(true)
    expect(isValidEmailLocalPart('a')).toBe(true)
  })
  it('rejects edge hyphens, uppercase and long values', () => {
    expect(isValidEmailLocalPart('-bad')).toBe(false)
    expect(isValidEmailLocalPart('bad-')).toBe(false)
    expect(isValidEmailLocalPart('UPPER')).toBe(false)
    expect(isValidEmailLocalPart('a'.repeat(65))).toBe(false)
  })
})

describe('getSenderDomain', () => {
  it('extracts the domain from display-name and bare forms', () => {
    expect(getSenderDomain('Placemaker <hello@placemakerai.io>')).toBe('placemakerai.io')
    expect(getSenderDomain('hello@placemakerai.io')).toBe('placemakerai.io')
  })
  it('refuses the shared onboarding domain and missing values', () => {
    expect(getSenderDomain('Placemaker <onboarding@resend.dev>')).toBeNull()
    expect(getSenderDomain(undefined)).toBeNull()
  })
})

describe('parseInboundAddress', () => {
  it('splits base and tag on our domain', () => {
    expect(parseInboundAddress('magnaparkcorby+e-ab12cd34@placemakerai.io', 'placemakerai.io'))
      .toEqual({ localPart: 'magnaparkcorby', tag: 'e-ab12cd34' })
  })
  it('handles untagged addresses and case', () => {
    expect(parseInboundAddress('MagnaParkCorby@Placemakerai.IO', 'placemakerai.io'))
      .toEqual({ localPart: 'magnaparkcorby', tag: null })
  })
  it('rejects other domains', () => {
    expect(parseInboundAddress('magnaparkcorby@evil.com', 'placemakerai.io')).toBeNull()
  })
})

describe('verifySvixSignature', () => {
  const secretBytes = crypto.randomBytes(24)
  const secret = `whsec_${secretBytes.toString('base64')}`
  const payload = '{"type":"email.received","data":{"email_id":"abc"}}'

  function sign(id: string, timestamp: string, body: string): string {
    return `v1,${crypto
      .createHmac('sha256', secretBytes)
      .update(`${id}.${timestamp}.${body}`)
      .digest('base64')}`
  }

  it('accepts a valid signature', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    expect(
      verifySvixSignature({
        secret,
        id: 'msg_1',
        timestamp,
        signature: sign('msg_1', timestamp, payload),
        payload,
      })
    ).toBe(true)
  })

  it('accepts a valid signature among several candidates', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const good = sign('msg_1', timestamp, payload)
    expect(
      verifySvixSignature({
        secret,
        id: 'msg_1',
        timestamp,
        signature: `v1,${Buffer.from('nope').toString('base64')} ${good}`,
        payload,
      })
    ).toBe(true)
  })

  it('rejects tampered payloads, wrong secrets and stale timestamps', () => {
    const timestamp = String(Math.floor(Date.now() / 1000))
    const good = sign('msg_1', timestamp, payload)
    expect(
      verifySvixSignature({ secret, id: 'msg_1', timestamp, signature: good, payload: payload + 'x' })
    ).toBe(false)
    expect(
      verifySvixSignature({
        secret: `whsec_${crypto.randomBytes(24).toString('base64')}`,
        id: 'msg_1',
        timestamp,
        signature: good,
        payload,
      })
    ).toBe(false)
    const stale = String(Math.floor(Date.now() / 1000) - 3600)
    expect(
      verifySvixSignature({ secret, id: 'msg_1', timestamp: stale, signature: sign('msg_1', stale, payload), payload })
    ).toBe(false)
  })

  it('rejects missing headers', () => {
    expect(
      verifySvixSignature({ secret, id: null, timestamp: null, signature: null, payload })
    ).toBe(false)
  })
})
