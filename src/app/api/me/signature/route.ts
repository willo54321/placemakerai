import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'

// The signed-in user's own email signature, appended to enquiry emails they send.

const MAX_SIGNATURE_LENGTH = 2000

export async function GET() {
  const session = await getAuth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailSignature: true },
  })
  return NextResponse.json({ signature: user?.emailSignature ?? '' })
}

export async function PUT(request: Request) {
  const session = await getAuth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (typeof body.signature !== 'string') {
    return NextResponse.json({ error: 'signature string is required' }, { status: 400 })
  }
  const signature = body.signature.replace(/\s+$/, '')
  if (signature.length > MAX_SIGNATURE_LENGTH) {
    return NextResponse.json({ error: `Signature is too long (${MAX_SIGNATURE_LENGTH} character limit)` }, { status: 400 })
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailSignature: signature || null },
  })
  return NextResponse.json({ signature })
}
