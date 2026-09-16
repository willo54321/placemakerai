import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; markerId: string }> }
) {
  const params = await props.params;
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  await prisma.mapMarker.deleteMany({
    where: { id: params.markerId, projectId: params.id },
  })
  return NextResponse.json({ success: true })
}
