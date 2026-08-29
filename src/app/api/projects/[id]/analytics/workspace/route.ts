import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { FullAnalysisResult } from '@/lib/ai'
import { collectFeedback, getBoundaryGeojson } from '@/lib/collect-feedback'

// GET - Everything the analysis workspace needs in one payload: the completed
// analysis plus the response texts it classified, so every count on screen can
// be traced to the responses behind it.
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const projectId = params.id

  const [project, cached, feedbackItems, boundary] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    }),
    prisma.analysisResult.findUnique({
      where: {
        projectId_type: {
          projectId,
          type: 'full',
        },
      },
    }),
    collectFeedback(projectId),
    getBoundaryGeojson(projectId),
  ])

  const hasAnalysis =
    cached &&
    cached.status !== 'failed' &&
    cached.data &&
    Object.keys(cached.data as object).length > 0

  return NextResponse.json({
    projectName: project?.name ?? 'Project',
    boundary,
    analysis: hasAnalysis ? (cached.data as unknown as FullAnalysisResult) : null,
    processing: cached?.status === 'processing' || cached?.status === 'finalizing',
    lastAnalyzed: hasAnalysis ? cached.updatedAt : null,
    items: feedbackItems.map(item => ({
      id: item.id,
      type: item.type,
      content: item.content,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      createdAt: item.createdAt,
    })),
  })
}
