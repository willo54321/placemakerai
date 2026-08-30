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

  const [entries, runs, projects] = await Promise.all([
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.auditLog.findMany({
      where: { action: 'analysis.run', createdAt: { gte: thirtyDaysAgo } },
      select: { projectId: true, detail: true, createdAt: true },
    }),
    prisma.project.findMany({ select: { id: true, name: true } }),
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
  })
}
