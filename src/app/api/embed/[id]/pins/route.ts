import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public API - submit feedback (pin, line, or polygon)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // First check if project exists and has embedding enabled
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { embedEnabled: true }
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

  // Validate category
  const validCategories = ['positive', 'negative', 'question', 'comment']
  const category = validCategories.includes(body.category) ? body.category : 'comment'

  // GDPR consent is required
  if (!body.gdprConsent) {
    return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400 })
  }

  // Create the feedback item
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
      mailingConsent: body.mailingConsent || false,
    }
  })

  // Only add to mailing list if email provided AND user consented
  if (body.email && body.mailingConsent) {
    try {
      await prisma.subscriber.upsert({
        where: {
          projectId_email: {
            projectId: params.id,
            email: body.email.toLowerCase(),
          },
        },
        create: {
          projectId: params.id,
          email: body.email.toLowerCase(),
          name: body.name || null,
          source: 'public_pin',
          sourceId: pin.id,
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
        update: {
          name: body.name || undefined,
          subscribed: true,
          unsubscribedAt: null,
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
      })
    } catch (error) {
      console.error('Failed to add subscriber from public pin:', error)
    }
  }

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
