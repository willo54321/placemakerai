/**
 * Construction-issue reporting: shared category list and helpers used by the
 * public embed API, the notification email and the admin UI, so the category
 * vocabulary can't drift between surfaces.
 */

export const ISSUE_CATEGORIES = ['noise', 'dust', 'traffic', 'damage', 'safety', 'hours', 'other'] as const

export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory, string> = {
  noise: 'Noise',
  dust: 'Dust & pollution',
  traffic: 'Traffic & access',
  damage: 'Property damage',
  safety: 'Safety concern',
  hours: 'Working hours',
  other: 'Other',
}

export function issueCategoryLabel(category: string): string {
  return ISSUE_CATEGORY_LABELS[category as IssueCategory] || ISSUE_CATEGORY_LABELS.other
}

// Capped so a mangled paste into the settings field can't fan a notification
// out to an unbounded recipient list.
const MAX_NOTIFY_RECIPIENTS = 10

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Matches the base64 data-URL fallback the upload endpoint returns when Blob
// storage isn't configured (local dev). ~4MB of base64 with headroom.
const MAX_DATA_URL_LENGTH = 6_000_000

/**
 * A submitted issue-report photoUrl must be something our own upload endpoint
 * produced for this project — a Vercel Blob URL under issues/{projectId}/, or
 * the local-dev data-URL fallback. Anything else (external hotlinks, other
 * projects' uploads) is rejected so the public map never embeds third-party
 * content.
 */
export function isAllowedIssuePhotoUrl(url: string, projectId: string): boolean {
  if (url.startsWith('data:image/')) {
    return url.length <= MAX_DATA_URL_LENGTH
  }
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'blob.vercel-storage.com' || parsed.hostname.endsWith('.blob.vercel-storage.com')) &&
      parsed.pathname.startsWith(`/issues/${projectId}/`)
    )
  } catch {
    return false
  }
}

/**
 * Parse the admin-entered issueNotifyEmails setting (free text — comma,
 * semicolon, space or newline separated) into a clean recipient list:
 * trimmed, lowercased, de-duplicated, invalid addresses dropped.
 */
export function parseNotifyEmails(raw: string | null | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase()
    if (!email || !EMAIL_RE.test(email)) continue
    seen.add(email)
    if (seen.size >= MAX_NOTIFY_RECIPIENTS) break
  }
  return Array.from(seen)
}
