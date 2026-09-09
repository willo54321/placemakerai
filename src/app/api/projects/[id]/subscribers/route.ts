import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'

// GET all subscribers for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const subscribers = await prisma.subscriber.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(subscribers)
}

// POST - add a subscriber manually. gdprConsent stays false on manual adds:
// the consent record belongs to the person, not the admin typing the address.
// Manual rows still receive campaigns (subscribed=true) — the admin is
// attesting to consent gathered offline (sign-up sheet, event, letter).
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  }

  const existing = await prisma.subscriber.findUnique({
    where: { projectId_email: { projectId: params.id, email } },
  })

  if (existing) {
    // Re-adding an unsubscribed address re-subscribes it.
    if (!existing.subscribed) {
      const updated = await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          subscribed: true,
          unsubscribedAt: null,
          name: body.name || existing.name,
        },
      })
      await logAudit({
        projectId: params.id,
        action: 'subscriber.add',
        targetType: 'Subscriber',
        targetId: updated.id,
        detail: { email, resubscribed: true },
      })
      return NextResponse.json(updated)
    }
    return NextResponse.json(existing)
  }

  const subscriber = await prisma.subscriber.create({
    data: {
      projectId: params.id,
      email,
      name: typeof body.name === 'string' ? body.name.slice(0, 100) : null,
      source: 'manual',
    },
  })

  await logAudit({
    projectId: params.id,
    action: 'subscriber.add',
    targetType: 'Subscriber',
    targetId: subscriber.id,
    detail: { email },
  })

  return NextResponse.json(subscriber)
}

// DELETE ?subscriberId= — hard delete (GDPR erasure). Opt-outs come through
// the public unsubscribe link instead, which keeps the consent history row.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const subscriberId = new URL(request.url).searchParams.get('subscriberId')
  if (!subscriberId) {
    return NextResponse.json({ error: 'subscriberId is required' }, { status: 400 })
  }

  const deleted = await prisma.subscriber.deleteMany({
    where: { id: subscriberId, projectId: params.id },
  })

  if (deleted.count > 0) {
    await logAudit({
      projectId: params.id,
      action: 'subscriber.delete',
      targetType: 'Subscriber',
      targetId: subscriberId,
    })
  }

  return NextResponse.json({ success: true })
}
