import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'

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
        createdAt: true,
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
    const { email, name, systemRole, projectAccess } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
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
        systemRole: systemRole || 'USER',
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

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to create user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
