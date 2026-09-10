// Shared validation for tour-stop payloads (admin create + update routes).

export interface StopPayload {
  title?: string
  description?: string
  imageUrl?: string | null
  videoUrl?: string | null
  latitude?: number
  longitude?: number
  zoom?: number
  highlight?: unknown
  showOverlays?: unknown
}

const STOP_FIELDS = [
  'title', 'description', 'imageUrl', 'videoUrl',
  'latitude', 'longitude', 'zoom', 'highlight', 'showOverlays',
]

function isValidHighlight(value: unknown): boolean {
  if (value === null) return true
  if (typeof value !== 'object' || value === null) return false
  const geom = value as { type?: unknown; coordinates?: unknown }
  return (
    geom.type === 'Polygon' &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0 &&
    Array.isArray(geom.coordinates[0]) &&
    (geom.coordinates[0] as unknown[]).length >= 3
  )
}

/**
 * Validate a stop payload. With `partial: true` (PATCH) only the provided
 * fields are validated; otherwise title/description/position are required.
 * Returns the list of problems (empty = valid) and the cleaned Prisma data.
 */
export function parseStopPayload(body: Record<string, unknown>, partial: boolean) {
  const errors: string[] = []
  const data: Record<string, unknown> = {}

  const unknownFields = Object.keys(body).filter(k => !STOP_FIELDS.includes(k))
  if (unknownFields.length > 0) {
    errors.push(`unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')}`)
  }

  if (body.title !== undefined || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      errors.push('title is required')
    } else if (body.title.trim().length > 120) {
      errors.push('title must be 120 characters or fewer')
    } else {
      data.title = body.title.trim()
    }
  }

  if (body.description !== undefined || !partial) {
    if (typeof body.description !== 'string' || !body.description.trim()) {
      errors.push('description is required')
    } else if (body.description.length > 4000) {
      errors.push('description must be 4000 characters or fewer')
    } else {
      data.description = body.description.trim()
    }
  }

  for (const key of ['imageUrl', 'videoUrl'] as const) {
    if (body[key] !== undefined) {
      const value = body[key]
      if (value === null || value === '') {
        data[key] = null
      } else if (typeof value !== 'string' || value.length > 1000) {
        errors.push(`${key} must be a URL of 1000 characters or fewer`)
      } else {
        data[key] = value
      }
    }
  }

  if (body.latitude !== undefined || body.longitude !== undefined || !partial) {
    const lat = Number(body.latitude)
    const lng = Number(body.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push('latitude and longitude must be valid coordinates')
    } else {
      data.latitude = lat
      data.longitude = lng
    }
  }

  if (body.zoom !== undefined) {
    const zoom = Number(body.zoom)
    if (!Number.isFinite(zoom) || zoom < 3 || zoom > 21) {
      errors.push('zoom must be between 3 and 21')
    } else {
      data.zoom = zoom
    }
  }

  if (body.highlight !== undefined) {
    if (!isValidHighlight(body.highlight)) {
      errors.push('highlight must be null or a GeoJSON Polygon')
    } else {
      data.highlight = body.highlight ?? null
    }
  }

  if (body.showOverlays !== undefined) {
    const value = body.showOverlays
    if (value === null) {
      data.showOverlays = null
    } else if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
      errors.push('showOverlays must be null or an array of overlay ids')
    } else {
      data.showOverlays = value
    }
  }

  return { errors, data }
}
