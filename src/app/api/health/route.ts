import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Health check, hit daily by the Vercel cron (see vercel.json).
// Its real job is the database query: Supabase free tier pauses projects
// after ~a week without activity, so this keeps the database awake.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Health check failed:', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
