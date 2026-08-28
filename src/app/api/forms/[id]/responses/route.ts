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
  const limited = rateLimitResponse(request, 'form-responses', 10, 60_000)
  if (limited) return limited

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  // GDPR consent is required
  if (!body.gdprConsent) {
    return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400, headers: corsHeaders })
  }

  // Validate that data is a non-empty plain object
  if (
    !body.data ||
    typeof body.data !== 'object' ||
    Array.isArray(body.data) ||
    Object.keys(body.data).length === 0
  ) {
    return NextResponse.json({ error: 'Invalid or empty data' }, { status: 400, headers: corsHeaders })
  }

  // Cap the serialized size of submitted data
  if (JSON.stringify(body.data).length > 20000) {
    return NextResponse.json({ error: 'Submission too large' }, { status: 400, headers: corsHeaders })
  }

  // Fetch the form FIRST (with its project's embedEnabled) before creating anything
  const form = await prisma.feedbackForm.findUnique({
    where: { id: params.id },
    select: {
      projectId: true,
      fields: true,
      active: true,
      Project: {
        select: { embedEnabled: true },
      },
    },
  })

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404, headers: corsHeaders })
  }

  if (!form.active || !form.Project?.embedEnabled) {
    return NextResponse.json({ error: 'Form is not accepting submissions' }, { status: 403, headers: corsHeaders })
  }

  // Create the feedback response
  const response = await prisma.feedbackResponse.create({
    data: {
      formId: params.id,
      data: body.data,
      gdprConsent: true,
      gdprConsentDate: new Date(),
    },
  })

  return NextResponse.json(response, { headers: corsHeaders })
}
