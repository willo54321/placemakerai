import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// Public API - upvote a pin
export async function POST(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  // Check if project exists and has embedding enabled
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { embedEnabled: true }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  if (!project.embedEnabled) {
    return NextResponse.json({ error: 'Voting not enabled for this project' }, { status: 403 })
  }

  // Find the pin and verify it belongs to this project
  const pin = await prisma.publicPin.findFirst({
    where: {
      id: params.pinId,
      projectId: params.id
    }
  })

  if (!pin) {
    return NextResponse.json({ error: 'Pin not found' }, { status: 404 })
  }

  // Increment the vote count
  const updatedPin = await prisma.publicPin.update({
    where: { id: params.pinId },
    data: { votes: { increment: 1 } }
  })

  return NextResponse.json({
    id: updatedPin.id,
    votes: updatedPin.votes
  })
}
