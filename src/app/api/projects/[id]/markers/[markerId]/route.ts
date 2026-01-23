import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; markerId: string } }
) {
  await prisma.mapMarker.delete({
    where: { id: params.markerId },
  })
  return NextResponse.json({ success: true })
}
