import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'

// The signed-in user's own product-tour preference.

export async function GET() {
  const session = await getAuth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { showTour: true },
  })
  return NextResponse.json({ showTour: user?.showTour ?? false })
}

export async function PATCH(request: Request) {
  const session = await getAuth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (typeof body.showTour !== 'boolean') {
    return NextResponse.json({ error: 'showTour boolean is required' }, { status: 400 })
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { showTour: body.showTour },
  })
  return NextResponse.json({ showTour: body.showTour })
}
