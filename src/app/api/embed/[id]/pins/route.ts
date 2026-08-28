import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

const FEEDBACK_CATEGORIES = ['positive', 'negative', 'question', 'comment']

// Public API - submit feedback (pin, line, or polygon)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const limited = rateLimitResponse(request, 'embed-pins', 15, 60_000)
  if (limited) return limited

  // First check if project exists and has embedding enabled
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      embedEnabled: true,
      name: true
    }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Feedback not enabled for this project' }, { status: 403 })
  }

  const body = await request.json()

  // Validate shape type
  const validShapeTypes = ['pin', 'line', 'polygon']
  const shapeType = validShapeTypes.includes(body.shapeType) ? body.shapeType : 'pin'

  // Collect every validation problem so submitters learn the full contract in
  // one round trip instead of fixing errors one at a time.
  const errors: string[] = []

  const lat = shapeType === 'pin' ? parseFloat(body.latitude) : null
  const lng = shapeType === 'pin' ? parseFloat(body.longitude) : null

  if (shapeType === 'pin') {
    if (!body.latitude || !body.longitude) {
      errors.push('latitude and longitude are required for a pin')
    } else if (
      lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      errors.push('latitude must be between -90 and 90 and longitude between -180 and 180')
    }
  } else {
    if (!body.geometry) {
      errors.push('geometry is required for a line or polygon')
    } else if (!body.geometry.type || !body.geometry.coordinates || !Array.isArray(body.geometry.coordinates)) {
      errors.push('geometry must be GeoJSON with type and coordinates')
    }
  }

  if (!body.comment) {
    errors.push('comment is required')
  } else if (typeof body.comment !== 'string' || body.comment.length > 2000) {
    errors.push('comment must be 2000 characters or fewer')
  }

  if (body.category !== undefined && !FEEDBACK_CATEGORIES.includes(body.category)) {
    errors.push(`category must be one of: ${FEEDBACK_CATEGORIES.join(', ')}`)
  }
  const category = FEEDBACK_CATEGORIES.includes(body.category) ? body.category : 'comment'

  if (!body.gdprConsent) {
    errors.push('GDPR consent is required')
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const pin = await prisma.publicPin.create({
    data: {
      projectId: params.id,
      shapeType,
      latitude: lat,
      longitude: lng,
      geometry: shapeType !== 'pin' ? body.geometry : null,
      category,
      comment: body.comment.slice(0, 2000), // Limit comment length
      name: body.name?.slice(0, 100) || null,
      // Email is deliberately not collected on map feedback (data minimization) —
      // it served no purpose: no reply workflow, no notifications, no mailing list.
      gdprConsent: true,
      gdprConsentDate: new Date(),
    }
  })

  return NextResponse.json({
    id: pin.id,
    shapeType: pin.shapeType,
    latitude: pin.latitude,
    longitude: pin.longitude,
    geometry: pin.geometry,
    category: pin.category,
    comment: pin.comment,
    name: pin.name,
    votes: pin.votes,
    createdAt: pin.createdAt
  })
}
