import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; memberId: string } }
) {
  const body = await request.json()
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
  await prisma.teamMember.delete({
    where: { id: params.memberId },
  })
  return NextResponse.json({ success: true })
}
