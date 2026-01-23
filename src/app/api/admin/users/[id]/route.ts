import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'

// Get a single user
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Failed to fetch user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// Update a user
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json()
    const { name, systemRole, projectAccess } = body

    // Update user basic info
    const updateData: { name?: string; systemRole?: 'SUPER_ADMIN' | 'USER' } = {}
    if (name !== undefined) updateData.name = name
    if (systemRole !== undefined) updateData.systemRole = systemRole

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    })

    // Update project access if provided
    if (projectAccess !== undefined) {
      // Delete existing project access
      await prisma.projectAccess.deleteMany({
        where: { userId: params.id },
      })

      // Create new project access
      if (projectAccess.length > 0) {
        await prisma.projectAccess.createMany({
          data: projectAccess.map((pa: { projectId: string; role: string }) => ({
            userId: params.id,
            projectId: pa.projectId,
            role: pa.role as 'ADMIN' | 'CLIENT',
          })),
        })
      }
    }

    // Fetch updated user with project access
    const updatedUser = await prisma.user.findUnique({
      where: { id: params.id },
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

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Failed to update user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// Delete a user
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Prevent deleting yourself
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
