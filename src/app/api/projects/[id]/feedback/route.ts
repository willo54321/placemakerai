import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

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
 *   "gdprConsent": true,          // Required
 *   "mailingConsent": false       // Optional
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
  const body = await request.json()

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
  let mailingConsent: boolean

  if (body.data && typeof body.data === 'object') {
    // Nested format: { data: {...}, gdprConsent: true }
    formData = body.data
    gdprConsent = body.gdprConsent === true
    mailingConsent = body.mailingConsent === true
  } else {
    // Flat format: { name: "...", email: "...", gdprConsent: true }
    const { gdprConsent: gc, mailingConsent: mc, ...rest } = body
    formData = rest
    gdprConsent = gc === true
    mailingConsent = mc === true
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

  // Create the feedback response
  const response = await prisma.feedbackResponse.create({
    data: {
      formId: form.id,
      data: formData,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      mailingConsent,
    },
  })

  // Extract email and name for mailing list
  let email: string | null = null
  let name: string | null = null

  for (const [key, value] of Object.entries(formData)) {
    if (!value || typeof value !== 'string') continue

    const keyLower = key.toLowerCase()
    if ((keyLower === 'email' || keyLower.includes('email')) && !email) {
      email = value.toLowerCase()
    }
    if ((keyLower === 'name' || keyLower === 'fullname' || keyLower === 'full_name') && !name) {
      name = value
    }
  }

  // Add to mailing list if email found AND user consented
  if (email && mailingConsent) {
    try {
      await prisma.subscriber.upsert({
        where: {
          projectId_email: {
            projectId,
            email,
          },
        },
        create: {
          projectId,
          email,
          name,
          source: 'external_form',
          sourceId: response.id,
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
        update: {
          name: name || undefined,
          subscribed: true,
          unsubscribedAt: null,
          gdprConsent: true,
          gdprConsentDate: new Date(),
        },
      })
    } catch (error) {
      console.error('Failed to add subscriber from external form:', error)
    }
  }

  return NextResponse.json(
    {
      success: true,
      id: response.id,
      message: 'Feedback submitted successfully',
    },
    { headers: corsHeaders }
  )
}
