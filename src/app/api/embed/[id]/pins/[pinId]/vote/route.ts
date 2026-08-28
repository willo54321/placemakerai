import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'
import { rateLimitResponse, getClientIp } from '@/lib/rate-limit'

// crypto requires the Node.js runtime
export const runtime = 'nodejs'

// Public API - upvote a pin (deduplicated per voter)
export async function POST(
  request: Request,
  { params }: { params: { id: string; pinId: string } }
) {
  // A real person votes a handful of times per session; 10/min blunts
  // scripted vote-stuffing without touching legitimate use.
  const limited = rateLimitResponse(request, 'embed-vote', 10, 60_000)
  if (limited) return limited

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

  // Find the pin and verify it belongs to this project and is approved
  const pin = await prisma.publicPin.findFirst({
    where: {
      id: params.pinId,
      projectId: params.id,
      approved: true
    }
  })

  if (!pin) {
    return NextResponse.json({ error: 'Pin not found' }, { status: 404 })
  }

  // Fingerprint the voter to prevent duplicate voting / stuffing
  const voterHash = createHash('sha256')
    .update(getClientIp(request) + '|' + (request.headers.get('user-agent') || ''))
    .digest('hex')

  try {
    const updatedPin = await prisma.$transaction(async (tx) => {
      // Throws P2002 if this voter already voted for this pin
      await tx.pinVote.create({
        data: { pinId: params.pinId, voterHash },
      })

      // First vote from this fingerprint - count it atomically
      return tx.publicPin.update({
        where: { id: params.pinId },
        data: { votes: { increment: 1 } },
      })
    })

    return NextResponse.json({
      id: updatedPin.id,
      votes: updatedPin.votes
    })
  } catch (error) {
    // Unique-constraint violation => already voted; do not increment
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const current = await prisma.publicPin.findUnique({
        where: { id: params.pinId },
        select: { id: true, votes: true },
      })

      return NextResponse.json({
        id: current?.id ?? params.pinId,
        votes: current?.votes ?? pin.votes,
        alreadyVoted: true
      })
    }

    throw error
  }
}
