import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  runFullAnalysis,
  createFeedbackHash,
  FeedbackItem,
  FullAnalysisResult,
} from '@/lib/openai'

// GET - Retrieve cached analysis or return null
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  // Always collect feedback to get the count
  const feedbackItems = await collectFeedback(projectId)
  const currentHash = createFeedbackHash(feedbackItems)

  // Get cached analysis
  const cached = await prisma.analysisResult.findUnique({
    where: {
      projectId_type: {
        projectId,
        type: 'full',
      },
    },
  })

  if (!cached) {
    return NextResponse.json({
      analysis: null,
      needsUpdate: true,
      feedbackCount: feedbackItems.length,
    })
  }

  return NextResponse.json({
    analysis: cached.data as unknown as FullAnalysisResult,
    needsUpdate: cached.feedbackHash !== currentHash,
    lastAnalyzed: cached.updatedAt,
    feedbackCount: feedbackItems.length,
  })
}

// POST - Run new analysis
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const projectId = params.id

  try {
    // Collect all feedback
    const feedbackItems = await collectFeedback(projectId)

    if (feedbackItems.length === 0) {
      return NextResponse.json({
        analysis: null,
        message: 'No feedback to analyze',
      })
    }

    // Run full analysis
    const analysis = await runFullAnalysis(feedbackItems)
    const feedbackHash = createFeedbackHash(feedbackItems)

    // Store result
    await prisma.analysisResult.upsert({
      where: {
        projectId_type: {
          projectId,
          type: 'full',
        },
      },
      update: {
        data: analysis as object,
        feedbackHash,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        type: 'full',
        data: analysis as object,
        feedbackHash,
      },
    })

    return NextResponse.json({
      analysis,
      feedbackCount: feedbackItems.length,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to run analysis' },
      { status: 500 }
    )
  }
}

// Helper to collect all feedback from a project
async function collectFeedback(projectId: string): Promise<FeedbackItem[]> {
  const feedbackItems: FeedbackItem[] = []

  // Get public pins
  const pins = await prisma.publicPin.findMany({
    where: { projectId, approved: true },
    orderBy: { createdAt: 'desc' },
  })

  pins.forEach(pin => {
    feedbackItems.push({
      id: pin.id,
      type: 'pin',
      content: pin.comment,
      category: pin.category,
      latitude: pin.latitude,
      longitude: pin.longitude,
      createdAt: pin.createdAt,
    })
  })

  // Get form responses
  const forms = await prisma.feedbackForm.findMany({
    where: { projectId },
    include: { responses: true },
  })

  forms.forEach(form => {
    const fields = form.fields as Array<{ id: string; label: string; type: string }>

    form.responses.forEach(response => {
      const data = response.data as Record<string, unknown>

      // Extract text content from response - check both by field.id and field.label
      const textContent = fields
        .filter(f => ['text', 'textarea'].includes(f.type))
        .map(f => {
          const value = data[f.id] || data[f.label]
          if (value && typeof value === 'string') {
            return `${f.label}: ${value}`
          }
          return null
        })
        .filter(Boolean)
        .join('. ')

      // Also capture any text fields submitted directly by label (for external forms)
      const directTextContent = Object.entries(data)
        .filter(([key, value]) => {
          // Skip if already captured via fields
          const isFieldKey = fields.some(f => f.id === key || f.label === key)
          return typeof value === 'string' && value.length > 10 && !isFieldKey
        })
        .map(([key, value]) => `${key}: ${value}`)
        .join('. ')

      const combinedContent = [textContent, directTextContent].filter(Boolean).join('. ')

      if (combinedContent) {
        feedbackItems.push({
          id: response.id,
          type: 'form',
          content: combinedContent,
          createdAt: response.submittedAt,
        })
      }
    })
  })

  // Get enquiries
  const enquiries = await prisma.enquiry.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })

  enquiries.forEach(enquiry => {
    feedbackItems.push({
      id: enquiry.id,
      type: 'enquiry',
      content: `${enquiry.subject}: ${enquiry.message}`,
      category: enquiry.category,
      createdAt: enquiry.createdAt,
    })
  })

  return feedbackItems
}
