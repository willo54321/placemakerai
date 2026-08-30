import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { sendOpsAlert } from '@/lib/email'

// Health + ops check, hit daily by the Vercel cron (see vercel.json) and
// usable by any external uptime monitor (UptimeRobot etc. — point it here).
//
// Its original job remains the database query: Supabase free tier pauses
// projects after ~a week without activity, so this keeps the database awake.
// It now also surfaces operational problems — failed or stuck analysis runs
// and unread contact messages — so a monitor alerting on non-200 catches
// them, and the daily cron writes them to the Vercel function logs.
export const dynamic = 'force-dynamic'

const STUCK_AFTER_MS = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const dayAgo = new Date(Date.now() - STUCK_AFTER_MS)

    const [failed, stuck, recentMessages] = await Promise.all([
      // Runs that failed in the last day — someone's analytics tab is broken.
      prisma.analysisResult.count({
        where: { status: 'failed', updatedAt: { gte: dayAgo } },
      }),
      // Runs claiming to be in flight for over a day — a batch that will
      // never land without a re-run.
      prisma.analysisResult.count({
        where: {
          status: { in: ['processing', 'finalizing'] },
          updatedAt: { lt: dayAgo },
        },
      }),
      // New leads in the last day — a nudge to check /admin/messages, since
      // no email delivery is configured.
      prisma.contactMessage.count({ where: { createdAt: { gte: dayAgo } } }),
    ])

    const problems: string[] = []
    if (failed > 0) problems.push(`${failed} analysis run(s) failed in the last 24h`)
    if (stuck > 0) problems.push(`${stuck} analysis run(s) stuck in flight for over 24h`)

    if (problems.length > 0 || recentMessages > 0) {
      // Shows up in Vercel logs on every cron hit; greppable and alertable.
      console.warn(
        `ops-check: ${problems.join('; ') || 'no failures'}${
          recentMessages > 0 ? `; ${recentMessages} new contact message(s) awaiting reply` : ''
        }`
      )
    }

    if (problems.length > 0) {
      // Email the team when configured (daily cron = at most one email a day).
      await sendOpsAlert(problems).catch(() => null)
      return NextResponse.json(
        { ok: false, problems, newContactMessages: recentMessages },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true, newContactMessages: recentMessages })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
