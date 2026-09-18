import { describe, it, expect } from 'vitest'
import { parseNotifyEmails, issueCategoryLabel, isAllowedIssuePhotoUrl } from './issues'

describe('isAllowedIssuePhotoUrl', () => {
  const projectId = 'proj123'

  it('accepts a Vercel Blob URL under this project prefix', () => {
    expect(isAllowedIssuePhotoUrl(`https://abc123.public.blob.vercel-storage.com/issues/${projectId}/photo.jpg`, projectId)).toBe(true)
  })

  it('rejects blob URLs for a different project', () => {
    expect(isAllowedIssuePhotoUrl('https://abc123.public.blob.vercel-storage.com/issues/otherproj/photo.jpg', projectId)).toBe(false)
  })

  it('rejects external hosts and non-https', () => {
    expect(isAllowedIssuePhotoUrl(`https://evil.example.com/issues/${projectId}/photo.jpg`, projectId)).toBe(false)
    expect(isAllowedIssuePhotoUrl(`http://abc.public.blob.vercel-storage.com/issues/${projectId}/photo.jpg`, projectId)).toBe(false)
    expect(isAllowedIssuePhotoUrl(`https://evil.com/?u=.blob.vercel-storage.com/issues/${projectId}/x`, projectId)).toBe(false)
    expect(isAllowedIssuePhotoUrl('not a url', projectId)).toBe(false)
  })

  it('accepts a small data-image URL (local dev fallback) but rejects oversized ones', () => {
    expect(isAllowedIssuePhotoUrl('data:image/jpeg;base64,abcd', projectId)).toBe(true)
    expect(isAllowedIssuePhotoUrl('data:text/html;base64,abcd', projectId)).toBe(false)
    expect(isAllowedIssuePhotoUrl(`data:image/jpeg;base64,${'a'.repeat(6_000_001)}`, projectId)).toBe(false)
  })
})

describe('parseNotifyEmails', () => {
  it('returns an empty list for null, undefined or blank input', () => {
    expect(parseNotifyEmails(null)).toEqual([])
    expect(parseNotifyEmails(undefined)).toEqual([])
    expect(parseNotifyEmails('')).toEqual([])
    expect(parseNotifyEmails('  ,;  ')).toEqual([])
  })

  it('splits on commas, semicolons, spaces and newlines', () => {
    expect(parseNotifyEmails('a@example.com, b@example.com;c@example.com\nd@example.com e@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
      'c@example.com',
      'd@example.com',
      'e@example.com',
    ])
  })

  it('lowercases, trims and de-duplicates', () => {
    expect(parseNotifyEmails(' Site.Manager@Example.com , site.manager@example.com ')).toEqual([
      'site.manager@example.com',
    ])
  })

  it('drops invalid addresses but keeps valid ones', () => {
    expect(parseNotifyEmails('not-an-email, ok@example.com, @missing.local, also.ok@example.co.uk')).toEqual([
      'ok@example.com',
      'also.ok@example.co.uk',
    ])
  })

  it('caps the recipient list at 10', () => {
    const raw = Array.from({ length: 15 }, (_, i) => `person${i}@example.com`).join(',')
    expect(parseNotifyEmails(raw)).toHaveLength(10)
  })
})

describe('issueCategoryLabel', () => {
  it('maps known categories to labels', () => {
    expect(issueCategoryLabel('noise')).toBe('Noise')
    expect(issueCategoryLabel('hours')).toBe('Working hours')
  })

  it('falls back to Other for unknown categories', () => {
    expect(issueCategoryLabel('unknown')).toBe('Other')
  })
})
