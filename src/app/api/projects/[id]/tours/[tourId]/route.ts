import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { withApiHandler } from '@/lib/api-error'
import { NextResponse } from 'next/server'

async function findTour(projectId: string, tourId: string) {
  const tour = await prisma.tour.findUnique({ where: { id: tourId } })
  if (!tour || tour.projectId !== projectId) return null
  return tour
}

// GET - A single tour with its ordered stops
export const GET = withApiHandler(async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; tourId: string }> }
) => {
  const params = await paramsPromise
  const denied = await authorizeProject(params.id, 'CLIENT')
  if (denied) return denied

  const tour = await prisma.tour.findUnique({
    where: { id: params.tourId },
    include: { stops: { orderBy: { order: 'asc' } } }
  })

  if (!tour || tour.projectId !== params.id) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  return NextResponse.json(tour)
})

// PATCH - Update tour name/description/active
export const PATCH = withApiHandler(async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; tourId: string }> }
) => {
  const params = await paramsPromise
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await findTour(params.id, params.tourId)
  if (!existing) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  const body = await request.json()
  const data: { name?: string; description?: string | null; active?: boolean } = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
      return NextResponse.json({ error: 'name must be 1-120 characters' }, { status: 400 })
    }
    data.name = body.name.trim()
  }
  if (body.description !== undefined) {
    data.description = typeof body.description === 'string' && body.description.trim()
      ? body.description.trim().slice(0, 1000)
      : null
  }
  if (body.active !== undefined) {
    data.active = Boolean(body.active)
  }

  const tour = await prisma.tour.update({
    where: { id: params.tourId },
    data,
    include: { stops: { orderBy: { order: 'asc' } } }
  })

  return NextResponse.json(tour)
})

// DELETE - Delete a tour (stops cascade; their feedback pins survive via SetNull)
export const DELETE = withApiHandler(async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ id: string; tourId: string }> }
) => {
  const params = await paramsPromise
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const existing = await findTour(params.id, params.tourId)
  if (!existing) {
    return NextResponse.json({ error: 'Tour not found' }, { status: 404 })
  }

  await prisma.tour.delete({ where: { id: params.tourId } })

  return NextResponse.json({ success: true })
})
