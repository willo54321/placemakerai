import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'
import { recordMailingConsent } from '@/lib/subscribers'

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

/**
 * Public mailing-list signup — the standalone counterpart to ticking mailing
 * consent on an enquiry or feedback submission. Embeddable in the client's
 * own site (WordPress etc.) as a plain form + fetch.
 *
 * POST /api/embed/{projectId}/subscribe
 * Body: { email, name?, gdprConsent: true }
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const limited = await rateLimitResponse(request, 'embed-subscribe', 5, 60_000)
  if (limited) return limited

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, embedEnabled: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Signups not enabled' }, { status: 403, headers: corsHeaders })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    body = null
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  // Name every problem in one response, using the actual field names of the
  // API contract, so integrators can fix their payload from the message alone.
  const errors: string[] = []

  const KNOWN_FIELDS = ['email', 'name', 'gdprConsent']
  const unknownFields = Object.keys(body).filter(k => !KNOWN_FIELDS.includes(k))
  if (unknownFields.length > 0) {
    errors.push(`unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')} (accepted fields: ${KNOWN_FIELDS.join(', ')})`)
  }

  if (!body.email) {
    errors.push('missing required field: email')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('email must be a valid email address')
  }
  if (!body.gdprConsent) {
    errors.push('GDPR consent is required')
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400, headers: corsHeaders })
  }

  const subscriber = await recordMailingConsent({
    projectId: params.id,
    email: body.email,
    name: typeof body.name === 'string' ? body.name.slice(0, 100) : null,
    source: 'subscribe_embed',
  })

  if (!subscriber) {
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500, headers: corsHeaders })
  }

  // Same response whether the address was new or already subscribed — the
  // endpoint must not act as an oracle for who is on the list.
  return NextResponse.json({
    success: true,
    message: "You're subscribed to project updates.",
  }, { headers: corsHeaders })
}
