import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

// Lazy initialization to avoid build errors when API key is missing
const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null
  return new Resend(process.env.RESEND_API_KEY)
}

// Issue categories for validation
const ISSUE_CATEGORIES = ['noise', 'dust', 'traffic', 'damage', 'safety', 'hours', 'other']
const FEEDBACK_CATEGORIES = ['positive', 'negative', 'question', 'comment']

// Public API - submit feedback or issue (pin, line, or polygon)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // First check if project exists and has embedding enabled
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      embedEnabled: true,
      issuesEnabled: true,
      issueNotifyEmails: true,
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

  // Validate mode
  const mode = body.mode === 'issues' ? 'issues' : 'feedback'

  // Check if issues mode is enabled for this project
  if (mode === 'issues' && !project.issuesEnabled) {
    return NextResponse.json({ error: 'Issue reporting not enabled for this project' }, { status: 403 })
  }

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

  // Validate category based on mode
  const validCategories = mode === 'issues' ? ISSUE_CATEGORIES : FEEDBACK_CATEGORIES
  const defaultCategory = mode === 'issues' ? 'other' : 'comment'
  const category = validCategories.includes(body.category) ? body.category : defaultCategory

  // For issues mode, name and email are required
  if (mode === 'issues') {
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { error: 'Name and email are required for issue reports' },
        { status: 400 }
      )
    }
  }

  // GDPR consent is required
  if (!body.gdprConsent) {
    return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400 })
  }

  // Create the feedback/issue item
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
      mode,
    }
  })

  // Send email notification for new issues
  if (mode === 'issues' && project.issueNotifyEmails) {
    const notifyEmails = project.issueNotifyEmails.split(',').map((e: string) => e.trim()).filter(Boolean)
    const resend = getResend()
    if (notifyEmails.length > 0 && resend) {
      try {
        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1)

        await resend.emails.send({
          from: 'PlaceMaker AI <notifications@placemaker.ai>',
          to: notifyEmails,
          subject: `New ${categoryLabel} Issue Reported - ${project.name}`,
          html: `
            <h2>New Construction Issue Reported</h2>
            <p><strong>Project:</strong> ${project.name}</p>
            <p><strong>Category:</strong> ${categoryLabel}</p>
            <p><strong>Reported by:</strong> ${pin.name} (${pin.email})</p>
            <hr>
            <p><strong>Description:</strong></p>
            <p>${pin.comment}</p>
            <hr>
            <p><em>This issue requires moderation before it appears on the public map.</em></p>
          `
        })
      } catch (emailError) {
        console.error('Failed to send issue notification email:', emailError)
        // Don't fail the request if email fails
      }
    }
  }

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
    createdAt: pin.createdAt,
    mode: pin.mode
  })
}
