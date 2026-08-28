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
  const form = await prisma.feedbackForm.create({
    data: {
      projectId: params.id,
      name: body.name,
      fields: body.fields,
    },
  })
  return NextResponse.json(form)
}
