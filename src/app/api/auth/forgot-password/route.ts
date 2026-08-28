import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'
import { sendSetPasswordEmail } from '@/lib/email'
import { issuePasswordToken, appBaseUrl, RESET_TOKEN_TTL_HOURS } from '@/lib/password-reset'

// Public endpoint: request a password-reset email.
// Always responds with success so it cannot be used to enumerate accounts.
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 'forgot-password', 5, 15 * 60_000)
  if (limited) return limited

  let email: unknown
  try {
    ({ email } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  })

  if (user) {
    try {
      const token = await issuePasswordToken(user.id, RESET_TOKEN_TTL_HOURS)
      await sendSetPasswordEmail({
        to: user.email,
        name: user.name,
        url: `${appBaseUrl()}/set-password?token=${token}`,
        mode: 'reset',
      })
    } catch (err) {
      // Log but still return the generic response below.
      console.error('Failed to issue password reset:', err)
    }
  }

  return NextResponse.json({
    success: true,
    message: 'If an account exists for that email, a reset link has been sent.',
  })
}
