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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // GDPR consent is required
  if (!body.gdprConsent) {
    return NextResponse.json({ error: 'GDPR consent is required' }, { status: 400, headers: corsHeaders })
  }

  // Create the feedback response
  const response = await prisma.feedbackResponse.create({
    data: {
      formId: params.id,
      data: body.data,
      gdprConsent: true,
      gdprConsentDate: new Date(),
      mailingConsent: body.mailingConsent || false,
    },
  })

  // Get the form to find the project ID and field definitions
  const form = await prisma.feedbackForm.findUnique({
    where: { id: params.id },
    select: {
      projectId: true,
      fields: true,
    },
  })

  if (form) {
    // Look for email fields in the response data
    const fields = form.fields as Array<{ id: string; type: string; label: string }>
    const responseData = body.data as Record<string, string>

    let email: string | null = null
    let name: string | null = null

    // Find email and name fields - check both by field.id and by label key
    for (const field of fields) {
      const value = responseData[field.id] || responseData[field.label]
      if (!value) continue

      if (field.type === 'email' || field.label.toLowerCase().includes('email')) {
        email = value.toLowerCase()
      }
      if (field.label.toLowerCase().includes('name') && !field.label.toLowerCase().includes('email')) {
        name = value
      }
    }

    // Also check response data keys directly (for external form submissions)
    for (const [key, value] of Object.entries(responseData)) {
      if (!value || typeof value !== 'string') continue

      if (key.toLowerCase() === 'email' && !email) {
        email = value.toLowerCase()
      }
      if (key.toLowerCase() === 'name' && !name) {
        name = value
      }
    }

    // Only add to mailing list if email found AND user consented
    if (email && body.mailingConsent) {
      try {
        await prisma.subscriber.upsert({
          where: {
            projectId_email: {
              projectId: form.projectId,
              email: email,
            },
          },
          create: {
            projectId: form.projectId,
            email: email,
            name: name,
            source: 'feedback_form',
            sourceId: response.id,
            gdprConsent: true,
            gdprConsentDate: new Date(),
          },
          update: {
            // If they re-submit, update name if provided
            name: name || undefined,
            // Re-subscribe if they had unsubscribed
            subscribed: true,
            unsubscribedAt: null,
            gdprConsent: true,
            gdprConsentDate: new Date(),
          },
        })
      } catch (error) {
        // Don't fail the form submission if subscriber creation fails
        console.error('Failed to add subscriber from feedback form:', error)
      }
    }
  }

  return NextResponse.json(response, { headers: corsHeaders })
}
