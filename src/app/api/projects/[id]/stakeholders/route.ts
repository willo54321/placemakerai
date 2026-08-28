import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()
  const stakeholder = await prisma.stakeholder.create({
    data: {
      projectId: params.id,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      organization: body.organization || null,
      role: body.role || null,
      category: body.category || 'neutral',
      notes: body.notes || null,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
    },
  })
  return NextResponse.json(stakeholder)
}
