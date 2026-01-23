import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const teamMembers = await prisma.teamMember.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(teamMembers)
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const teamMember = await prisma.teamMember.create({
    data: {
      projectId: params.id,
      name: body.name,
      email: body.email,
      role: body.role || null,
    },
  })
  return NextResponse.json(teamMember)
}
