import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { rateLimitResponse } from '@/lib/rate-limit'

// Cap auto-detected form fields to prevent unbounded schema growth
const MAX_AUTO_FIELDS = 50

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
 * Submit feedback directly to a project from an external form.
 *
 * This endpoint auto-detects fields from the submitted data and creates
 * or uses an "External Submissions" form to store the response.
 *
 * POST /api/projects/{projectId}/feedback
 *
 * Body:
 * {
 *   "data": { ...any form fields... },
 *   "gdprConsent": true           // Required
 * }
 *
 * Or submit fields directly at the root level:
 * {
 *   "name": "John",
 *   "email": "john@example.com",
 *   "message": "Hello!",
 *   "gdprConsent": true
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  const limited = rateLimitResponse(request, 'ext-feedback', 10, 60_000)
  if (limited) return limited

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders }
    )
  }

  // Cap the size of the submitted payload
  if (JSON.stringify(body).length > 20000) {
    return NextResponse.json(
      { error: 'Submission too large' },
      { status: 400, headers: corsHeaders }
    )
  }

  // Check project exists and embedding is enabled
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, embedEnabled: true, name: true },
  })

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404, headers: corsHeaders }
    )
  }

  if (!project.embedEnabled) {
    return NextResponse.json(
      { error: 'External submissions are not enabled for this project' },
      { status: 403, headers: corsHeaders }
    )
  }

  // Extract data - support both nested {data: {...}} and flat submission
  let formData: Record<string, unknown>
  let gdprConsent: boolean

  if (body.data && typeof body.data === 'object') {
    // Nested format: { data: {...}, gdprConsent: true }
    formData = body.data
    gdprConsent = body.gdprConsent === true
  } else {
    // Flat format: { name: "...", email: "...", gdprConsent: true }
    const { gdprConsent: gc, mailingConsent: _mc, ...rest } = body
    formData = rest
    gdprConsent = gc === true
  }

  // GDPR consent is required
  if (!gdprConsent) {
    return NextResponse.json(
      { error: 'GDPR consent is required' },
      { status: 400, headers: corsHeaders }
    )
  }

  // Find or create the "External Submissions" form for this project
  let form = await prisma.feedbackForm.findFirst({
    where: {
      projectId,
      name: 'External Submissions',
    },
  })

  if (!form) {
    // Create a generic form to hold external submissions
    form = await prisma.feedbackForm.create({
      data: {
        projectId,
        name: 'External Submissions',
        fields: [], // Fields are auto-detected from submissions
        active: true,
      },
    })
  }

  // Auto-detect and update form fields from submission keys
  const existingFields = (form.fields as any[]) || []
  const existingLabels = new Set(existingFields.map((f: any) => f.label))
  const newFields = [...existingFields]

  for (const key of Object.keys(formData)) {
    // Stop auto-adding fields once the form is at capacity to prevent
    // unbounded growth of the form schema from malicious submissions.
    if (newFields.length >= MAX_AUTO_FIELDS) break

    // Skip common meta fields
    if (['gdprConsent', 'consent', 'mailingConsent'].includes(key)) continue

    // Create a human-readable label from the key
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim()

    if (!existingLabels.has(label)) {
      newFields.push({
        label,
        type: 'text',
        required: false,
      })
      existingLabels.add(label)
    }
  }

  // Update form fields if new ones were added
  if (newFields.length > existingFields.length) {
    await prisma.feedbackForm.update({
      where: { id: form.id },
      data: { fields: newFields },
    })
  }

  // Create the feedback response
  const response = await prisma.feedbackResponse.create({
    data: {
      formId: form.id,
      data: formData as Prisma.InputJsonValue,
      gdprConsent: true,
      gdprConsentDate: new Date(),
    },
  })

  return NextResponse.json(
    {
      success: true,
      id: response.id,
      message: 'Feedback submitted successfully',
    },
    { headers: corsHeaders }
  )
}
