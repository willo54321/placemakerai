import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const body = await request.json()

  // Verify the team member belongs to this project
  const existing = await prisma.teamMember.findFirst({
    where: { id: params.memberId, projectId: params.id },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  }

  const teamMember = await prisma.teamMember.update({
    where: { id: params.memberId },
    data: {
      name: body.name,
      email: body.email,
      role: body.role || null,
    },
  })
  return NextResponse.json(teamMember)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  await prisma.teamMember.deleteMany({
    where: { id: params.memberId, projectId: params.id },
  })
  return NextResponse.json({ success: true })
}
