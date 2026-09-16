import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { withApiHandler } from '@/lib/api-error'
import { NextResponse } from 'next/server'

// GET - List all tours for a project (with ordered stops)
export const GET = withApiHandler(async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) => {
  const params = await paramsPromise
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const tours = await prisma.tour.findMany({
    where: { projectId: params.id },
    include: {
      stops: { orderBy: { order: 'asc' } }
    },
    orderBy: { createdAt: 'asc' }
  })

  return NextResponse.json(tours)
})

// POST - Create a new tour (starts as a draft)
export const POST = withApiHandler(async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) => {
  const params = await paramsPromise
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (body.name.trim().length > 120) {
    return NextResponse.json({ error: 'name must be 120 characters or fewer' }, { status: 400 })
  }

  const tour = await prisma.tour.create({
    data: {
      projectId: params.id,
      name: body.name.trim(),
      description: typeof body.description === 'string' && body.description.trim()
        ? body.description.trim().slice(0, 1000)
        : null,
    },
    include: { stops: true }
  })

  return NextResponse.json(tour)
})
