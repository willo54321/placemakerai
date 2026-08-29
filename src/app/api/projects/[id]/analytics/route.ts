import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import {
  startFullAnalysis,
  isAnalysisBatchReady,
  finalizeFullAnalysis,
  createFeedbackHash,
  FeedbackItem,
  FullAnalysisResult,
  PendingAnalysis,
} from '@/lib/ai'

// Analysis runs through the Batch API: POST submits the run (one taxonomy call
// plus the batch submission, well under a minute), and GET finalizes it once
// the batch ends (aggregation in code plus two summary calls). Neither leg
// scales with the size of the consultation, so 60s covers both.
export const maxDuration = 60

function isEmptyData(data: unknown): boolean {
  return !data || Object.keys(data as object).length === 0
}

// GET - Retrieve the cached analysis, advancing an in-flight run if its batch
// has finished. The frontend polls this while `processing` is true.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const projectId = params.id

  // Always collect feedback to get the count
  const feedbackItems = await collectFeedback(projectId)
  const currentHash = createFeedbackHash(feedbackItems)

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

  // A run is in flight — check whether its batch has finished and finalize it
  // here if so. Finalizing on the poll avoids needing a separate worker.
  if (cached.status === 'processing' && cached.batchId && cached.pending) {
    try {
      if (await isAnalysisBatchReady(cached.batchId)) {
        // Claim the finalize step atomically so two concurrent polls can't
        // both pay for the summary calls.
        const claimed = await prisma.analysisResult.updateMany({
          where: { id: cached.id, status: 'processing' },
          data: { status: 'finalizing' },
        })

        if (claimed.count === 1) {
          try {
            const analysis = await finalizeFullAnalysis(
              cached.pending as unknown as PendingAnalysis,
              feedbackItems
            )
            await prisma.analysisResult.update({
              where: { id: cached.id },
              data: {
                data: analysis as object,
                status: 'complete',
                batchId: null,
                pending: Prisma.DbNull,
                error: null,
                updatedAt: new Date(),
              },
            })
            return NextResponse.json({
              analysis,
              needsUpdate: false,
              lastAnalyzed: new Date(),
              feedbackCount: feedbackItems.length,
            })
          } catch (error) {
            console.error('Analysis finalize error:', error)
            await prisma.analysisResult.update({
              where: { id: cached.id },
              data: {
                status: 'failed',
                batchId: null,
                pending: Prisma.DbNull,
                error: 'Failed to collect analysis results',
              },
            })
            return NextResponse.json({
              analysis: isEmptyData(cached.data)
                ? null
                : (cached.data as unknown as FullAnalysisResult),
              needsUpdate: true,
              analysisFailed: true,
              feedbackCount: feedbackItems.length,
            })
          }
        }
      }
    } catch (error) {
      // Batch status check failed (transient) — report still-processing and
      // let the next poll retry.
      console.error('Analysis status check error:', error)
    }

    return NextResponse.json({
      analysis: isEmptyData(cached.data)
        ? null
        : (cached.data as unknown as FullAnalysisResult),
      processing: true,
      needsUpdate: false,
      feedbackCount: feedbackItems.length,
    })
  }

  if (cached.status === 'finalizing') {
    // Another request is collecting the results right now. If that attempt
    // died mid-flight (timeout/crash), re-arm the run so the next poll
    // retries — batchId and pending are still on the row.
    const claimAge = Date.now() - new Date(cached.updatedAt).getTime()
    if (claimAge > 5 * 60 * 1000) {
      await prisma.analysisResult.updateMany({
        where: { id: cached.id, status: 'finalizing' },
        data: { status: 'processing' },
      })
    }
    return NextResponse.json({
      analysis: isEmptyData(cached.data)
        ? null
        : (cached.data as unknown as FullAnalysisResult),
      processing: true,
      needsUpdate: false,
      feedbackCount: feedbackItems.length,
    })
  }

  return NextResponse.json({
    analysis: isEmptyData(cached.data)
      ? null
      : (cached.data as unknown as FullAnalysisResult),
    needsUpdate: cached.feedbackHash !== currentHash || cached.status === 'failed',
    analysisFailed: cached.status === 'failed' || undefined,
    lastAnalyzed: cached.updatedAt,
    feedbackCount: feedbackItems.length,
  })
}

// POST - Start a new analysis run (returns immediately; poll GET for results)
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const projectId = params.id

  try {
    // Determine whether the caller wants to force a re-run, bypassing the cache.
    // Supported via `?force=1` query param or `{ force: true }` request body.
    const url = new URL(request.url)
    const forceParam = url.searchParams.get('force')
    let force = forceParam === '1' || forceParam === 'true'
    if (!force) {
      try {
        const body = await request.json()
        if (body && typeof body === 'object' && body.force === true) {
          force = true
        }
      } catch {
        // No/invalid JSON body — treat as no force override.
      }
    }

    // Collect all feedback
    const feedbackItems = await collectFeedback(projectId)

    if (feedbackItems.length === 0) {
      return NextResponse.json({
        analysis: null,
        message: 'No feedback to analyze',
      })
    }

    const feedbackHash = createFeedbackHash(feedbackItems)

    const cached = await prisma.analysisResult.findUnique({
      where: {
        projectId_type: {
          projectId,
          type: 'full',
        },
      },
    })

    // A run is already in flight — don't double-submit, even on force.
    if (cached && (cached.status === 'processing' || cached.status === 'finalizing')) {
      return NextResponse.json({
        processing: true,
        feedbackCount: feedbackItems.length,
      })
    }

    // If the feedback is unchanged and the caller hasn't forced a re-run,
    // return the cache instead of paying for a fresh run.
    if (
      !force &&
      cached &&
      cached.status === 'complete' &&
      cached.feedbackHash === feedbackHash
    ) {
      return NextResponse.json({
        analysis: cached.data as unknown as FullAnalysisResult,
        feedbackCount: feedbackItems.length,
        cached: true,
        lastAnalyzed: cached.updatedAt,
      })
    }

    // Submit the run: taxonomy call + batch submission. The previous result
    // stays in `data` so the UI can keep showing it while the new run cooks.
    const pending = await startFullAnalysis(feedbackItems)

    await prisma.analysisResult.upsert({
      where: {
        projectId_type: {
          projectId,
          type: 'full',
        },
      },
      update: {
        status: 'processing',
        batchId: pending.batchId,
        pending: pending as unknown as object,
        feedbackHash,
        error: null,
        updatedAt: new Date(),
      },
      create: {
        projectId,
        type: 'full',
        data: {},
        status: 'processing',
        batchId: pending.batchId,
        pending: pending as unknown as object,
        feedbackHash,
      },
    })

    return NextResponse.json({
      processing: true,
      feedbackCount: feedbackItems.length,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis' },
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

  // Enquiries are collected (public embed form) but not yet part of the
  // analysis — re-add them here when the enquiry channel is enabled.

  return feedbackItems
}
