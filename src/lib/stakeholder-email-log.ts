import { prisma } from './db'

// Automatic stakeholder engagement log from the enquiry desk. Every email to
// or from a stakeholder — an enquiry's original submission, inbound replies,
// and staff emails including CC/BCC — becomes one engagement entry, matched
// on exact (case-insensitive) email address. Matching is deliberately
// deterministic: attaching the wrong person's email to a stakeholder is a
// GDPR problem, so no fuzzy or AI matching here. Entries are idempotent per
// (stakeholder, email) via sourceKey, so callers can re-run freely.

export interface EmailEvent {
  /** `enq:<enquiryId>` for an original submission, `msg:<messageId>` for a message. */
  key: string
  enquiryId: string
  direction: 'inbound' | 'outbound'
  date: Date
  subject: string
  body: string
  /** The non-staff addresses on the email: sender for inbound; To/CC/BCC for outbound. */
  addresses: string[]
}

interface EnquiryWithMessages {
  id: string
  channel: string
  submitterEmail: string
  subject: string
  message: string
  createdAt: Date
  messages: Array<{
    id: string
    direction: string
    body: string
    authorEmail: string | null
    cc: string[]
    bcc: string[]
    createdAt: Date
  }>
}

const SNIPPET_LIMIT = 600

const normalise = (addresses: Array<string | null | undefined>) =>
  Array.from(new Set(addresses.filter((a): a is string => !!a?.trim()).map(a => a.trim().toLowerCase())))

type ThreadRef = Pick<EnquiryWithMessages, 'id' | 'submitterEmail' | 'subject'>
type MessageRef = EnquiryWithMessages['messages'][number]

/** The original submission of a public or emailed-in enquiry. */
export function submissionEvent(enquiry: ThreadRef & Pick<EnquiryWithMessages, 'message' | 'createdAt'>): EmailEvent {
  return {
    key: `enq:${enquiry.id}`,
    enquiryId: enquiry.id,
    direction: 'inbound',
    date: enquiry.createdAt,
    subject: enquiry.subject,
    body: enquiry.message,
    addresses: normalise([enquiry.submitterEmail]),
  }
}

/** One message in a thread: inbound from its author, outbound to the correspondent plus CC/BCC. */
export function messageEvent(enquiry: ThreadRef, m: MessageRef): EmailEvent {
  const outbound = m.direction === 'outbound'
  return {
    key: `msg:${m.id}`,
    enquiryId: enquiry.id,
    direction: outbound ? 'outbound' : 'inbound',
    date: m.createdAt,
    subject: enquiry.subject,
    body: m.body,
    addresses: outbound
      ? normalise([enquiry.submitterEmail, ...m.cc, ...m.bcc])
      : normalise([m.authorEmail]),
  }
}

/** Every email in a thread, as events. A team-started thread has no synthetic root. */
export function emailEventsForEnquiry(enquiry: EnquiryWithMessages): EmailEvent[] {
  return [
    ...(enquiry.channel !== 'outbound' ? [submissionEvent(enquiry)] : []),
    ...enquiry.messages.map(m => messageEvent(enquiry, m)),
  ]
}

/** First part of an email body, without the quoted history of earlier messages. */
export function emailSnippet(body: string): string {
  const cut = body.search(/^(On .+ wrote:|-{2,} ?Original Message ?-{2,}|From: .+)$|^>/m)
  const text = (cut > 0 ? body.slice(0, cut) : body).trim()
  return text.length > SNIPPET_LIMIT ? `${text.slice(0, SNIPPET_LIMIT).trimEnd()}…` : text
}

function entryData(stakeholderId: string, event: EmailEvent, aiEnabled: boolean) {
  return {
    stakeholderId,
    type: 'email',
    title: (event.subject || '(no subject)').slice(0, 200),
    description: emailSnippet(event.body) || null,
    date: event.date,
    source: 'email',
    enquiryId: event.enquiryId,
    sourceKey: event.key,
    direction: event.direction,
    aiStatus: aiEnabled ? 'pending' : null,
  }
}

const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY

/**
 * Log one email against every stakeholder in the project whose address is on
 * it. Returns the ids of entries created by this call (pending AI summary).
 */
export async function logEmailEvent(projectId: string, event: EmailEvent): Promise<string[]> {
  if (event.addresses.length === 0) return []
  const stakeholders = await prisma.stakeholder.findMany({
    where: {
      projectId,
      OR: event.addresses.map(address => ({ email: { equals: address, mode: 'insensitive' as const } })),
    },
    select: { id: true },
  })
  if (stakeholders.length === 0) return []

  await prisma.stakeholderEngagement.createMany({
    data: stakeholders.map(s => entryData(s.id, event, aiEnabled())),
    skipDuplicates: true,
  })
  const created = await prisma.stakeholderEngagement.findMany({
    where: { sourceKey: event.key, stakeholderId: { in: stakeholders.map(s => s.id) }, aiStatus: 'pending' },
    select: { id: true },
  })
  return created.map(e => e.id)
}

/**
 * Backfill one stakeholder's log from every email in the project that
 * involves their address — run when a stakeholder is created, their email
 * changes, or their record is opened. Already-logged emails are skipped.
 */
export async function syncStakeholderEmailHistory(stakeholder: {
  id: string
  projectId: string
  email: string | null
}): Promise<void> {
  const email = stakeholder.email?.trim().toLowerCase()
  if (!email) return

  const enquiries = await prisma.enquiry.findMany({
    where: {
      projectId: stakeholder.projectId,
      OR: [
        { submitterEmail: { equals: email, mode: 'insensitive' } },
        {
          messages: {
            some: {
              OR: [
                { cc: { has: email } },
                { bcc: { has: email } },
                { direction: 'inbound', authorEmail: { equals: email, mode: 'insensitive' } },
              ],
            },
          },
        },
      ],
    },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  const events = enquiries
    .flatMap(emailEventsForEnquiry)
    .filter(event => event.addresses.includes(email))
  if (events.length === 0) return

  await prisma.stakeholderEngagement.createMany({
    data: events.map(event => entryData(stakeholder.id, event, aiEnabled())),
    skipDuplicates: true,
  })
}

// Personal mailbox providers: a shared domain here says nothing about
// organisation, so these never produce "same organisation" suggestions.
const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com',
  'live.co.uk', 'msn.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net', 'protonmail.com',
  'proton.me', 'gmx.com', 'gmx.co.uk', 'mail.com', 'ntlworld.com', 'blueyonder.co.uk',
])

/** The organisational domain of an address, or null for personal mailbox providers. */
export function organisationDomain(address: string): string | null {
  const domain = address.trim().toLowerCase().split('@')[1]
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return null
  return domain
}
