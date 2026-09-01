import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { sendSetPasswordEmail } from '@/lib/email'
import { issuePasswordToken, appBaseUrl, INVITE_TOKEN_TTL_HOURS } from '@/lib/password-reset'
import bcrypt from 'bcryptjs'

// Get all users (super admin only)
export async function GET() {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (currentUser?.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        showTour: true,
        createdAt: true,
        lastLoginAt: true,
        lastActiveAt: true,
        projectAccess: {
          include: {
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// Create a new user (super admin only)
export async function POST(request: Request) {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is super admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (currentUser?.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, systemRole, projectAccess, password, showTour } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        password: password ? await bcrypt.hash(password, 10) : null,
        systemRole: systemRole || 'USER',
        showTour: typeof showTour === 'boolean' ? showTour : true,
        projectAccess: projectAccess?.length
          ? {
              create: projectAccess.map((pa: { projectId: string; role: string }) => ({
                projectId: pa.projectId,
                role: pa.role,
              })),
            }
          : undefined,
      },
      include: {
        projectAccess: {
          include: {
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // If the admin set a password directly, the user can sign in immediately —
    // no invite email needed. Otherwise email a set-password link.
    let inviteEmailSent = false
    if (!password) {
      try {
        const token = await issuePasswordToken(user.id, INVITE_TOKEN_TTL_HOURS)
        const result = await sendSetPasswordEmail({
          to: user.email,
          name: user.name,
          url: `${appBaseUrl()}/set-password?token=${token}`,
          mode: 'invite',
        })
        inviteEmailSent = Boolean(result)
      } catch (inviteError) {
        console.error('Failed to send invite email:', inviteError)
      }
    }

    const { password: _pw, passwordResetToken: _prt, ...safeUser } = user
    await logAudit({
      action: 'user.create',
      targetType: 'User',
      targetId: user.id,
      detail: { email: user.email, systemRole: user.systemRole },
    })

    return NextResponse.json({ ...safeUser, inviteEmailSent })
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
