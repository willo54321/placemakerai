import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

/**
 * Unsubscribe a mailing-list address by capability token.
 *
 * Two callers: the /unsubscribe confirmation page (JSON body { token }), and
 * mail clients doing RFC 8058 one-click unsubscribe, which POST a form body to
 * the List-Unsubscribe URL (?token=... query param). Accept both shapes.
 */
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 'unsubscribe', 10, 60_000)
  if (limited) return limited

  let token = new URL(request.url).searchParams.get('token')
  if (!token) {
    const body = await request.json().catch(() => null)
    if (body && typeof body.token === 'string') token = body.token
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing unsubscribe token' }, { status: 400 })
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
  })

  if (!subscriber) {
    return NextResponse.json({ error: 'Invalid unsubscribe link' }, { status: 404 })
  }

  if (subscriber.subscribed) {
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: { subscribed: false, unsubscribedAt: new Date() },
    })
  }

  // Idempotent: an already-unsubscribed token still reports success.
  return NextResponse.json({ success: true })
}
