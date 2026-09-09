import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'

/**
 * Mailing-list CSV export — for use in the client's own email tooling, and
 * for GDPR access requests. One row per subscriber including consent dates
 * and unsubscribe state, so the export is also the consent record.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { name: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'asc' },
  })

  await logAudit({
    projectId: params.id,
    action: 'export.download',
    detail: { type: 'subscribers', count: subscribers.length },
  })

  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const rows: string[] = [
    'email,name,source,subscribed,consent_given_at,unsubscribed_at,added_at',
  ]
  subscribers.forEach(subscriber => {
    rows.push(
      [
        subscriber.email,
        subscriber.name ?? '',
        subscriber.source,
        subscriber.subscribed,
        subscriber.gdprConsentDate?.toISOString() ?? '',
        subscriber.unsubscribedAt?.toISOString() ?? '',
        subscriber.createdAt.toISOString(),
      ].map(escape).join(',')
    )
  })

  const stamp = new Date().toISOString().slice(0, 10)
  const slug = project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-subscribers-${stamp}.csv"`,
    },
  })
}
