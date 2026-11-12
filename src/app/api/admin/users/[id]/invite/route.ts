import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { sendSetPasswordEmail } from '@/lib/email'
import { issuePasswordToken, appBaseUrl, INVITE_TOKEN_TTL_HOURS } from '@/lib/password-reset'

// Send a fresh login invite to an existing user (super admin only): issues a
// new set-password link and emails it. Used when the original invite expired,
// never arrived, or the account was created with no password set. Issuing a
// new token invalidates any outstanding one.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (currentUser?.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, email: true, name: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const token = await issuePasswordToken(user.id, INVITE_TOKEN_TTL_HOURS)
    const result = await sendSetPasswordEmail({
      to: user.email,
      name: user.name,
      url: `${appBaseUrl()}/set-password?token=${token}`,
      mode: 'invite',
    })

    if (!result) {
      // The token is set, but email delivery isn't configured — don't pretend it sent.
      return NextResponse.json(
        { error: 'Email delivery is not configured, so the invite could not be sent' },
        { status: 502 }
      )
    }

    await logAudit({
      action: 'user.invite',
      targetType: 'User',
      targetId: user.id,
      detail: { email: user.email },
    })

    return NextResponse.json({ sent: true })
  } catch (error) {
    console.error('Failed to send invite:', error)
    return NextResponse.json({ error: 'Failed to send invite' }, { status: 500 })
  }
}
