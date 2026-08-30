import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeSuperAdmin } from '@/lib/api-auth'

/**
 * Super-admin audit trail + usage summary. Usage is derived from the
 * audit log itself: every analysis run writes an `analysis.run` entry with
 * its item count, so the trail doubles as the metering record.
 */
export async function GET() {
  const denied = await authorizeSuperAdmin()
  if (denied) return denied

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [entries, runs, projects, failedRuns, stuckRuns, newMessages] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.auditLog.findMany({
      where: { action: 'analysis.run', createdAt: { gte: thirtyDaysAgo } },
      select: { projectId: true, detail: true, createdAt: true },
    }),
    prisma.project.findMany({ select: { id: true, name: true } }),
    // Domain health: analysis runs currently in a failed state.
    prisma.analysisResult.findMany({
      where: { status: 'failed' },
      select: { projectId: true, error: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
    // Runs claiming to be in flight for over a day — dead without a re-run.
    prisma.analysisResult.findMany({
      where: { status: { in: ['processing', 'finalizing'] }, updatedAt: { lt: dayAgo } },
      select: { projectId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
    prisma.contactMessage.count({ where: { createdAt: { gte: dayAgo } } }),
  ])

  const projectNames = Object.fromEntries(projects.map(p => [p.id, p.name]))

  const usageByProject: Record<string, { projectId: string; projectName: string; runs: number; itemsClassified: number }> = {}
  runs.forEach(run => {
    if (!run.projectId) return
    const entry = (usageByProject[run.projectId] ??= {
      projectId: run.projectId,
      projectName: projectNames[run.projectId] ?? 'Deleted project',
      runs: 0,
      itemsClassified: 0,
    })
    entry.runs++
    const detail = run.detail as { itemCount?: number } | null
    entry.itemsClassified += detail?.itemCount ?? 0
  })

  return NextResponse.json({
    entries: entries.map(entry => ({
      ...entry,
      projectName: entry.projectId ? projectNames[entry.projectId] ?? 'Deleted project' : null,
    })),
    usage: Object.values(usageByProject).sort((a, b) => b.runs - a.runs),
    usageWindowDays: 30,
    health: {
      // Reaching this line means the database answered every query above.
      database: 'ok',
      failedRuns: failedRuns.map(run => ({
        projectName: projectNames[run.projectId] ?? 'Deleted project',
        error: run.error,
        at: run.updatedAt,
      })),
      stuckRuns: stuckRuns.map(run => ({
        projectName: projectNames[run.projectId] ?? 'Deleted project',
        status: run.status,
        since: run.updatedAt,
      })),
      newMessages24h: newMessages,
    },
  })
}
