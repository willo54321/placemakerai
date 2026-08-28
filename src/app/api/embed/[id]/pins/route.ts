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

  // Validate based on shape type
  if (shapeType === 'pin') {
    if (!body.latitude || !body.longitude || !body.comment) {
      return NextResponse.json(
        { error: 'Missing required fields for pin: latitude, longitude, comment' },
        { status: 400 }
      )
    }
  } else {
    // Line or polygon - require geometry
    if (!body.geometry || !body.comment) {
      return NextResponse.json(
        { error: 'Missing required fields for shape: geometry, comment' },
        { status: 400 }
      )
    }
    // Validate geometry structure
    if (!body.geometry.type || !body.geometry.coordinates || !Array.isArray(body.geometry.coordinates)) {
      return NextResponse.json(
        { error: 'Invalid geometry format. Expected GeoJSON with type and coordinates' },
        { status: 400 }
      )
    }
  }

  const category = FEEDBACK_CATEGORIES.includes(body.category) ? body.category : 'comment'

  // GDPR consent is required
  if (!body.gdprConsent) {
    return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400 })
  }

  const pin = await prisma.publicPin.create({
    data: {
      projectId: params.id,
      shapeType,
      latitude: shapeType === 'pin' ? parseFloat(body.latitude) : null,
      longitude: shapeType === 'pin' ? parseFloat(body.longitude) : null,
      geometry: shapeType !== 'pin' ? body.geometry : null,
      category,
      comment: body.comment.slice(0, 2000), // Limit comment length
      name: body.name?.slice(0, 100) || null,
      email: body.email?.slice(0, 255) || null,
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
