import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET all subscribers for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const subscribers = await prisma.subscriber.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(subscribers)
}

// POST - add a new subscriber manually
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Check if subscriber already exists
  const existing = await prisma.subscriber.findUnique({
    where: {
      projectId_email: {
        projectId: params.id,
        email: body.email.toLowerCase(),
      },
    },
  })

  if (existing) {
    // If they unsubscribed, re-subscribe them
    if (!existing.subscribed) {
      const updated = await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          subscribed: true,
          unsubscribedAt: null,
          name: body.name || existing.name,
        },
      })
      return NextResponse.json(updated)
    }
    return NextResponse.json(existing)
  }

  const subscriber = await prisma.subscriber.create({
    data: {
      projectId: params.id,
      email: body.email.toLowerCase(),
      name: body.name || null,
      source: body.source || 'manual',
      sourceId: body.sourceId || null,
    },
  })

  return NextResponse.json(subscriber)
}

// DELETE - remove subscriber or unsubscribe
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const subscriberId = searchParams.get('subscriberId')

  if (subscriberId) {
    await prisma.subscriber.delete({
      where: { id: subscriberId },
    })
  } else if (email) {
    await prisma.subscriber.updateMany({
      where: {
        projectId: params.id,
        email: email.toLowerCase(),
      },
      data: {
        subscribed: false,
        unsubscribedAt: new Date(),
      },
    })
  }

  return NextResponse.json({ success: true })
}
