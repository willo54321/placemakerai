// Shared parsing for staff-composed enquiry emails (new threads and replies).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MAX_COPIED_RECIPIENTS = 20

/**
 * Parse a CC/BCC field — an array or a comma/semicolon/whitespace-separated
 * string, optionally with "Name <addr>" entries — into unique lower-cased
 * addresses. Returns the invalid entries separately so the API can name them.
 */
export function parseEmailList(input: unknown): { emails: string[]; invalid: string[] } {
  const parts = Array.isArray(input)
    ? input.filter((p): p is string => typeof p === 'string')
    : typeof input === 'string'
      ? input.split(/[,;\n]/)
      : []
  const emails: string[] = []
  const invalid: string[] = []
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const address = (trimmed.match(/<([^>]+)>\s*$/)?.[1] ?? trimmed).trim().toLowerCase()
    if (!EMAIL_RE.test(address)) invalid.push(trimmed)
    else if (!emails.includes(address)) emails.push(address)
  }
  return { emails, invalid }
}

/**
 * Validate the CC and BCC fields of a compose request. Addresses already in
 * To (or in CC, for BCC) are dropped so nobody gets the email twice.
 */
export function parseCopiedRecipients(
  raw: { cc?: unknown; bcc?: unknown },
  to: string
): { cc: string[]; bcc: string[]; error?: string } {
  const cc = parseEmailList(raw.cc)
  const bcc = parseEmailList(raw.bcc)
  const invalid = [...cc.invalid, ...bcc.invalid]
  if (invalid.length) {
    return { cc: [], bcc: [], error: `Invalid email address${invalid.length > 1 ? 'es' : ''}: ${invalid.join(', ')}` }
  }
  const toAddr = to.trim().toLowerCase()
  const ccList = cc.emails.filter(e => e !== toAddr)
  const bccList = bcc.emails.filter(e => e !== toAddr && !ccList.includes(e))
  if (ccList.length + bccList.length > MAX_COPIED_RECIPIENTS) {
    return { cc: [], bcc: [], error: `Too many CC/BCC recipients (limit ${MAX_COPIED_RECIPIENTS})` }
  }
  return { cc: ccList, bcc: bccList }
}

/** Append the sender's signature, separated by a blank line. */
export function withSignature(body: string, signature: string | null | undefined): string {
  const sig = signature?.trim()
  return sig ? `${body}\n\n${sig}` : body
}
