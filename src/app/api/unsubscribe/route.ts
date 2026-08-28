import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

// Public endpoint: unsubscribe a mailing-list subscriber. The subscriber id
// (an unguessable cuid, delivered only in that subscriber's own emails) acts
// as the capability token.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 'unsubscribe', 20, 60_000)
  if (limited) return limited

  let sid: unknown
  try {
    ({ sid } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof sid !== 'string' || !sid) {
    return NextResponse.json({ error: 'Missing subscriber reference' }, { status: 400 })
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: sid },
    select: { id: true, subscribed: true },
  })

  if (!subscriber) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
  }

  if (subscriber.subscribed) {
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { subscribed: false, unsubscribedAt: new Date() },
    })
  }

  return NextResponse.json({ success: true })
}
