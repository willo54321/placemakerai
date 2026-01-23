import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { canAccessProject } from '@/lib/permissions'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check project access
    const access = await canAccessProject(session.user.id, params.id)
    if (!access.canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        stakeholders: true,
        mapMarkers: true,
        feedbackForms: {
          include: {
            _count: { select: { responses: true } },
          },
        },
        imageOverlays: {
          orderBy: { createdAt: 'asc' }
        },
        publicPins: {
          orderBy: { createdAt: 'desc' }
        },
        teamMembers: {
          orderBy: { createdAt: 'asc' }
        },
        enquiries: {
          include: { assignedTo: true },
          orderBy: { createdAt: 'desc' }
        },
        subscribers: {
          where: { subscribed: true },
          orderBy: { createdAt: 'desc' }
        },
        tours: {
          include: {
            stops: {
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        userAccess: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
      },
    })
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Include user's role for this project in the response
    return NextResponse.json({
      ...project,
      _userRole: access.role,
      _isAdmin: access.isAdmin,
    })
  } catch (error) {
    console.error('Failed to fetch project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check project access - need admin role to update
    const access = await canAccessProject(session.user.id, params.id)
    if (!access.canAccess || !access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()

    // Build update data, only including fields that were explicitly provided
    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.latitude !== undefined) updateData.latitude = body.latitude
    if (body.longitude !== undefined) updateData.longitude = body.longitude
    if (body.mapZoom !== undefined) updateData.mapZoom = body.mapZoom
    if (body.embedEnabled !== undefined) updateData.embedEnabled = body.embedEnabled
    if (body.allowPins !== undefined) updateData.allowPins = body.allowPins
    if (body.allowDrawing !== undefined) updateData.allowDrawing = body.allowDrawing
    if ('emailFromName' in body) updateData.emailFromName = body.emailFromName || null
    if ('emailFromAddress' in body) updateData.emailFromAddress = body.emailFromAddress || null

    const project = await prisma.project.update({
      where: { id: params.id },
      data: updateData,
    })
    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super admins can delete projects
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (user?.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only super admins can delete projects' },
        { status: 403 }
      )
    }

    await prisma.project.delete({
      where: { id: params.id },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
