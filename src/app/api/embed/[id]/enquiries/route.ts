import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

// CORS headers for cross-origin form submissions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const limited = rateLimitResponse(request, 'embed-enquiry', 5, 60_000)
  if (limited) return limited

  // Verify project exists and has embed enabled
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      embedEnabled: true,
    },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Enquiries not enabled' }, { status: 403, headers: corsHeaders })
  }

  const body = await request.json()

  // Name every problem in one response so submitters don't discover the
  // contract one error at a time.
  // Error messages must use the ACTUAL field names of the API contract, so
  // integrators can fix their payload from the message alone.
  const missing = (['submitterName', 'submitterEmail', 'subject', 'message'] as const).filter(
    field => !body[field]
  )
  const errors: string[] = missing.length ? [`missing required field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`] : []

  const KNOWN_FIELDS = ['submitterName', 'submitterEmail', 'submitterPhone', 'submitterOrg', 'subject', 'message', 'category', 'gdprConsent', 'mailingConsent']
  const unknownFields = Object.keys(body).filter(k => !KNOWN_FIELDS.includes(k))
  if (unknownFields.length > 0) {
    errors.push(`unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')} (accepted fields: ${KNOWN_FIELDS.slice(0, -1).join(', ')})`)
  }

  if (body.submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.submitterEmail)) {
    errors.push('submitterEmail must be a valid email address')
  }
  if (!body.gdprConsent) {
    errors.push('GDPR consent is required')
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400, headers: corsHeaders })
  }

  const enquiry = await prisma.enquiry.create({
    data: {
      projectId: params.id,
      submitterName: body.submitterName,
      submitterEmail: body.submitterEmail,
      submitterPhone: body.submitterPhone || null,
      submitterOrg: body.submitterOrg || null,
      subject: body.subject,
      message: body.message,
      category: body.category || 'general',
      gdprConsent: true,
      gdprConsentDate: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    reference: enquiry.id,
    message: 'Your enquiry has been submitted successfully.',
  }, { headers: corsHeaders })
}
