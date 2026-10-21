import { parseInboundAddress } from './email-identity'

// Pure helpers for routing mail received on a project address. A project
// address can be the main recipient (an enquiry to the team) or just copied
// in on someone else's correspondence — typically a team member CC'ing or
// BCC'ing it from their own mail client so the conversation lands in the
// stakeholder log without using the Placemaker inbox.

export interface Mailbox {
  name: string | null
  email: string
}

/** "Jane Doe <jane@x.com>" -> { name: 'Jane Doe', email: 'jane@x.com' } */
export function parseMailbox(raw: string): Mailbox {
  const match = raw.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/)
  if (match) return { name: match[1]?.trim() || null, email: match[2].trim().toLowerCase() }
  return { name: null, email: raw.trim().toLowerCase() }
}

/**
 * The people on a recipient list who aren't us: drops addresses on the
 * platform domain and the project team's own addresses, and de-duplicates.
 */
export function externalRecipients(
  list: string[] | null | undefined,
  domain: string,
  team: Set<string>,
  exclude: string[] = []
): Mailbox[] {
  const seen = new Set(exclude)
  const out: Mailbox[] = []
  for (const raw of list ?? []) {
    const box = parseMailbox(raw)
    if (!box.email.includes('@') || seen.has(box.email)) continue
    if (team.has(box.email) || parseInboundAddress(box.email, domain)) continue
    seen.add(box.email)
    out.push(box)
  }
  return out
}

/** Whether any address on the list is this project's own address (any tag). */
export function addressesProject(list: string[] | null | undefined, domain: string, localPart: string): boolean {
  return (list ?? []).some(raw => parseInboundAddress(parseMailbox(raw).email, domain)?.localPart === localPart)
}

/** Message-IDs an email replies to, from its In-Reply-To and References headers. */
export function referencedMessageIds(headers: Record<string, string> | null | undefined): string[] {
  if (!headers) return []
  const ids = new Set<string>()
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase()
    if (k !== 'in-reply-to' && k !== 'references') continue
    for (const id of String(value).match(/<[^<>\s]+>/g) ?? []) ids.add(id)
  }
  return Array.from(ids)
}

/** Message-ID in its canonical bracketed form, or null. */
export function normaliseMessageId(id: string | null | undefined): string | null {
  const trimmed = id?.trim()
  if (!trimmed) return null
  return trimmed.startsWith('<') ? trimmed : `<${trimmed}>`
}

export type NewThreadKind =
  /** Sent to the project address: an enquiry for the team, as before. */
  | { kind: 'enquiry' }
  /** Correspondence the project was only copied on, or a team member's own email. */
  | { kind: 'copied'; direction: 'inbound' | 'outbound'; correspondent: Mailbox }

/**
 * How a new (unthreaded) email to a project address should be stored.
 * - A team member's email with someone else on To/CC is their own
 *   correspondence, copied in for the record: outbound, with the first
 *   external recipient as the correspondent.
 * - Anyone else's email with the project only on CC/BCC is correspondence
 *   addressed to someone else (usually a team member): inbound copy.
 * - Everything else — mail sent to the project address, or a team member
 *   forwarding something in — is an enquiry.
 */
export function classifyNewThread(args: {
  sender: Mailbox
  senderIsTeam: boolean
  projectInTo: boolean
  to: Mailbox[]
  cc: Mailbox[]
}): NewThreadKind {
  if (args.senderIsTeam) {
    const correspondent = args.to[0] ?? args.cc[0]
    return correspondent ? { kind: 'copied', direction: 'outbound', correspondent } : { kind: 'enquiry' }
  }
  if (!args.projectInTo) return { kind: 'copied', direction: 'inbound', correspondent: args.sender }
  return { kind: 'enquiry' }
}
