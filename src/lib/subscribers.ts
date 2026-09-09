import { prisma } from '@/lib/db'

/**
 * Record mailing-list consent for an email address on a project. Called from
 * every capture point (subscribe embed, enquiry form, external feedback form,
 * manual add). Never throws — losing a subscriber must not fail the
 * submission that carried the consent.
 *
 * Semantics: a fresh tick of the consent box is fresh consent, so a
 * previously-unsubscribed address is re-subscribed. An already-subscribed
 * address keeps its original record (first name/source wins, name backfilled
 * if we only just learned it).
 */
export async function recordMailingConsent({
  projectId,
  email,
  name,
  source,
  sourceId,
}: {
  projectId: string
  email: string
  name?: string | null
  source: 'manual' | 'enquiry' | 'feedback_form' | 'subscribe_embed'
  sourceId?: string | null
}) {
  const normalized = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null

  try {
    const existing = await prisma.subscriber.findUnique({
      where: { projectId_email: { projectId, email: normalized } },
    })

    if (existing) {
      if (!existing.subscribed || (!existing.name && name)) {
        return await prisma.subscriber.update({
          where: { id: existing.id },
          data: {
            subscribed: true,
            unsubscribedAt: null,
            name: existing.name || name || null,
            gdprConsent: true,
            gdprConsentDate: new Date(),
          },
        })
      }
      return existing
    }

    return await prisma.subscriber.create({
      data: {
        projectId,
        email: normalized,
        name: name || null,
        source,
        sourceId: sourceId || null,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      },
    })
  } catch (err) {
    console.error('Failed to record mailing consent:', err)
    return null
  }
}
