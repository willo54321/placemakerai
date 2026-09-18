import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'
import { recordMailingConsent } from '@/lib/subscribers'
import { sendIssueNotification } from '@/lib/email'
import { ISSUE_CATEGORIES, issueCategoryLabel, parseNotifyEmails, isAllowedIssuePhotoUrl } from '@/lib/issues'

const FEEDBACK_CATEGORIES = ['positive', 'negative', 'question', 'comment']

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Public API - submit feedback or a construction-issue report (pin, line, or polygon)
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const limited = await rateLimitResponse(request, 'embed-pins', 15, 60_000)
  if (limited) return limited

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

  // "feedback" (proposal feedback) or "issues" (construction-issue report).
  const mode = body.mode === 'issues' ? 'issues' : 'feedback'

  if (mode === 'issues' && !project.issuesEnabled) {
    return NextResponse.json({ error: 'Issue reporting not enabled for this project' }, { status: 403 })
  }

  // Validate shape type
  const validShapeTypes = ['pin', 'line', 'polygon']
  const shapeType = validShapeTypes.includes(body.shapeType) ? body.shapeType : 'pin'

  // Collect every validation problem so submitters learn the full contract in
  // one round trip instead of fixing errors one at a time.
  const errors: string[] = []

  // Reject unknown fields so integrator typos (e.g. `type` instead of
  // `category`) fail loudly instead of being silently ignored.
  const KNOWN_FIELDS = ['mode', 'shapeType', 'latitude', 'longitude', 'geometry', 'category', 'comment', 'name', 'gdprConsent', 'email', 'mailingConsent', 'tourStopId', 'photoUrl']
  const unknownFields = Object.keys(body).filter(k => !KNOWN_FIELDS.includes(k))
  if (unknownFields.length > 0) {
    errors.push(`unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')} (accepted fields: ${KNOWN_FIELDS.join(', ')})`)
  }

  if (body.mode !== undefined && !['feedback', 'issues'].includes(body.mode)) {
    errors.push('mode must be "feedback" or "issues"')
  }

  // Feedback left from a guided-tour stop panel carries the stop id so it can
  // be shown under that stop. The stop must belong to an active tour of this
  // project — otherwise submitters could attach feedback to arbitrary stops.
  let tourStopId: string | null = null
  if (body.tourStopId !== undefined && body.tourStopId !== null) {
    if (mode === 'issues') {
      errors.push('tourStopId cannot be set on an issue report')
    } else if (typeof body.tourStopId !== 'string') {
      errors.push('tourStopId must be a string')
    } else {
      const stop = await prisma.tourStop.findUnique({
        where: { id: body.tourStopId },
        select: { tour: { select: { projectId: true, active: true } } }
      })
      if (!stop || stop.tour.projectId !== params.id || !stop.tour.active) {
        errors.push('tourStopId does not match an active tour stop of this project')
      } else {
        tourStopId = body.tourStopId
      }
    }
  }

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

  const validCategories = mode === 'issues' ? ISSUE_CATEGORIES as readonly string[] : FEEDBACK_CATEGORIES
  if (body.category !== undefined && !validCategories.includes(body.category)) {
    errors.push(`category must be one of: ${validCategories.join(', ')}`)
  }
  const category = validCategories.includes(body.category)
    ? body.category
    : (mode === 'issues' ? 'other' : 'comment')

  // Issue reports need a way to follow up (and to send the resolution), so
  // name and a valid email are required — unlike map feedback, where email is
  // deliberately not collected (data minimization).
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (mode === 'issues') {
    if (!name) errors.push('name is required for an issue report')
    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      errors.push('a valid email is required for an issue report')
    }
  }

  // Optional photo evidence on issue reports. Must be an upload our own
  // issue-photo endpoint produced for this project — never an external URL.
  let photoUrl: string | null = null
  if (body.photoUrl !== undefined && body.photoUrl !== null && body.photoUrl !== '') {
    if (mode !== 'issues') {
      errors.push('photoUrl is only accepted on issue reports')
    } else if (typeof body.photoUrl !== 'string' || !isAllowedIssuePhotoUrl(body.photoUrl, params.id)) {
      errors.push('photoUrl must be an upload returned by the issue-photo endpoint')
    } else {
      photoUrl = body.photoUrl
    }
  }

  if (!body.gdprConsent) {
    errors.push('GDPR consent is required')
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 })
  }

  const pin = await prisma.publicPin.create({
    data: {
      projectId: params.id,
      mode,
      shapeType,
      latitude: lat,
      longitude: lng,
      geometry: shapeType !== 'pin' ? body.geometry : null,
      category,
      comment: body.comment.slice(0, 2000), // Limit comment length
      name: name.slice(0, 100) || null,
      // Email is collected on issue reports only — feedback pins stay
      // email-free (no reply workflow there).
      email: mode === 'issues' ? email : null,
      photoUrl,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      tourStopId,
    }
  })

  if (mode === 'issues') {
    // Nudge the nominated recipients (e.g. the site manager). Never fails the
    // submission — sendIssueNotification swallows its own errors.
    const recipients = parseNotifyEmails(project.issueNotifyEmails)
    if (recipients.length > 0) {
      const baseUrl = process.env.NEXTAUTH_URL || 'https://platform.placemakerai.io'
      await sendIssueNotification({
        to: recipients,
        projectId: params.id,
        projectName: project.name,
        categoryLabel: issueCategoryLabel(category),
        reporterName: name,
        reporterEmail: email,
        comment: pin.comment,
        photoUrl: photoUrl && !photoUrl.startsWith('data:') ? photoUrl : null,
        baseUrl,
      })
    }

    if (body.mailingConsent === true) {
      await recordMailingConsent({
        projectId: params.id,
        email,
        name,
        source: 'issue_report',
        sourceId: pin.id,
      })
    }
  }

  return NextResponse.json({
    id: pin.id,
    mode: pin.mode,
    shapeType: pin.shapeType,
    latitude: pin.latitude,
    longitude: pin.longitude,
    geometry: pin.geometry,
    category: pin.category,
    comment: pin.comment,
    votes: pin.votes,
    createdAt: pin.createdAt
  })
}
