/**
 * Project email identity helpers. A project can send from its own address on
 * the platform's verified domain (<emailLocalPart>@<EMAIL_FROM domain>) —
 * Resend verifies domains, not addresses, so any local part on the verified
 * domain sends without extra setup. Pure functions: shared by API validation,
 * the Settings form, and address construction in lib/email.ts.
 */

export const EMAIL_LOCAL_PART_MAX = 64

// Lowercase letters, digits and hyphens; must start and end alphanumeric.
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export function isValidEmailLocalPart(value: string): boolean {
  return value.length <= EMAIL_LOCAL_PART_MAX && LOCAL_PART_RE.test(value)
}

/** "Magna Park Corby" -> "magnaparkcorby". Null when nothing usable remains. */
export function deriveEmailLocalPart(name: string): string | null {
  const derived = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, EMAIL_LOCAL_PART_MAX)
  return isValidEmailLocalPart(derived) ? derived : null
}

/**
 * Domain of the platform's from address, e.g. "placemakerai.io" from
 * "Placemaker.ai <hello@placemakerai.io>". Returns null when EMAIL_FROM is
 * unset or on Resend's shared onboarding domain, where only the exact
 * onboarding address may send — project identities need a real domain.
 */
export function getSenderDomain(emailFrom = process.env.EMAIL_FROM): string | null {
  const domain = emailFrom?.match(/@([A-Za-z0-9.-]+)>?\s*$/)?.[1]?.toLowerCase()
  if (!domain || domain === 'resend.dev') return null
  return domain
}

/**
 * Whether inbound email is wired up: replies can only be routed back into the
 * platform once the Resend receiving webhook exists (its signing secret is the
 * signal) and the domain can carry project addresses. Until then outbound mail
 * keeps Reply-To = the sending admin.
 */
export function inboundEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_WEBHOOK_SECRET && getSenderDomain())
}

/**
 * Tagged reply address for a project, e.g. "magnaparkcorby+e-ab12cd34@placemakerai.io".
 * Tags: "e-<threadToken>" threads a reply into an enquiry; "c-<campaignId>"
 * marks a campaign reply. Null when inbound email isn't configured or the
 * project has no sending address — callers fall back to the admin's email.
 */
export function getProjectReplyAddress(
  project: { emailLocalPart?: string | null },
  tag: string
): string | null {
  if (!inboundEmailEnabled() || !project.emailLocalPart) return null
  return `${project.emailLocalPart}+${tag}@${getSenderDomain()}`
}

/**
 * Split an inbound recipient address on our domain into its project local
 * part and optional routing tag. Returns null for other domains.
 */
export function parseInboundAddress(
  address: string,
  domain: string
): { localPart: string; tag: string | null } | null {
  const match = address
    .trim()
    .toLowerCase()
    .match(/^([a-z0-9][a-z0-9.-]*)(?:\+([a-z0-9._-]+))?@(.+)$/)
  if (!match || match[3] !== domain.toLowerCase()) return null
  return { localPart: match[1], tag: match[2] ?? null }
}
