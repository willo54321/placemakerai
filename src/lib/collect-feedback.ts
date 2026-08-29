import { prisma } from '@/lib/db'
import { FeedbackItem } from '@/lib/ai'

/**
 * Gather every analysable piece of feedback for a project: approved map pins
 * and form responses. Used by the analytics routes and the analysis
 * workspace, so all of them see an identical corpus.
 */
export async function collectFeedback(projectId: string): Promise<FeedbackItem[]> {
  const feedbackItems: FeedbackItem[] = []

  // Get public pins
  const pins = await prisma.publicPin.findMany({
    where: { projectId, approved: true },
    orderBy: { createdAt: 'desc' },
  })

  pins.forEach(pin => {
    feedbackItems.push({
      id: pin.id,
      type: 'pin',
      content: pin.comment,
      category: pin.category,
      latitude: pin.latitude,
      longitude: pin.longitude,
      createdAt: pin.createdAt,
    })
  })

  // Get form responses
  const forms = await prisma.feedbackForm.findMany({
    where: { projectId },
    include: { responses: true },
  })

  forms.forEach(form => {
    const fields = form.fields as Array<{ id: string; label: string; type: string }>

    form.responses.forEach(response => {
      const data = response.data as Record<string, unknown>

      // Extract text content from response - check both by field.id and field.label
      const textContent = fields
        .filter(f => ['text', 'textarea'].includes(f.type))
        .map(f => {
          const value = data[f.id] || data[f.label]
          if (value && typeof value === 'string') {
            return `${f.label}: ${value}`
          }
          return null
        })
        .filter(Boolean)
        .join('. ')

      // Also capture any text fields submitted directly by label (for external forms)
      const directTextContent = Object.entries(data)
        .filter(([key, value]) => {
          // Skip if already captured via fields
          const isFieldKey = fields.some(f => f.id === key || f.label === key)
          return typeof value === 'string' && value.length > 10 && !isFieldKey
        })
        .map(([key, value]) => `${key}: ${value}`)
        .join('. ')

      const combinedContent = [textContent, directTextContent].filter(Boolean).join('. ')

      if (combinedContent) {
        feedbackItems.push({
          id: response.id,
          type: 'form',
          content: combinedContent,
          createdAt: response.submittedAt,
        })
      }
    })
  })

  // Enquiries are collected (public embed form) but not yet part of the
  // analysis — re-add them here when the enquiry channel is enabled.

  return feedbackItems
}

/**
 * The project's boundary layer geojson, if it has one — the frame of
 * reference for naming spatial findings.
 */
export async function getBoundaryGeojson(projectId: string): Promise<unknown | null> {
  const layer = await prisma.geoLayer.findFirst({
    where: { projectId, type: 'boundary' },
    orderBy: { createdAt: 'asc' },
  })
  return layer?.geojson ?? null
}
