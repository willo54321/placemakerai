import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { rateLimitResponse } from '@/lib/rate-limit'

const MIN_PASSWORD_LENGTH = 8

// Public endpoint: consume a set-password token (from an invite or a
// forgot-password email) and set the user's password.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 'set-password', 10, 15 * 60_000)
  if (limited) return limited

  let token: unknown
  let password: unknown
  try {
    ({ token, password } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    )
  }

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
    select: { id: true, email: true },
  })

  if (!user) {
    return NextResponse.json(
      { error: 'This link is invalid or has expired. Please request a new one.' },
      { status: 400 }
    )
  }

  const hashed = await bcrypt.hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashed,
      emailVerified: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  })

  return NextResponse.json({ success: true, email: user.email })
}
