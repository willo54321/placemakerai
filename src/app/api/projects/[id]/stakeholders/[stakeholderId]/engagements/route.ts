import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const engagements = await prisma.stakeholderEngagement.findMany({
    where: { stakeholderId: params.stakeholderId },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(engagements)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; stakeholderId: string } }
) {
  const body = await request.json()

  const engagement = await prisma.stakeholderEngagement.create({
    data: {
      stakeholderId: params.stakeholderId,
      type: body.type,
      title: body.title,
      description: body.description || null,
      date: body.date ? new Date(body.date) : new Date(),
      outcome: body.outcome || null,
      nextAction: body.nextAction || null,
    },
  })

  return NextResponse.json(engagement)
}
