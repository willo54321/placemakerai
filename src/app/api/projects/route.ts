import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { getAccessibleProjects, requireAuth, requireSuperAdmin } from '@/lib/permissions'

export async function GET() {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add timeout to prevent hanging on database connection issues
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database connection timeout')), 10000)
    )

    // Get user to check if they're super admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    let queryPromise

    if (user?.systemRole === 'SUPER_ADMIN') {
      // Super admins see all projects
      queryPromise = prisma.project.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              stakeholders: true,
              feedbackForms: true,
              mapMarkers: true,
            },
          },
          userAccess: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      })
    } else {
      // Regular users only see projects they have access to
      const projectAccess = await prisma.projectAccess.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      })
      const projectIds = projectAccess.map((pa) => pa.projectId)

      queryPromise = prisma.project.findMany({
        where: { id: { in: projectIds } },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              stakeholders: true,
              feedbackForms: true,
              mapMarkers: true,
            },
          },
        },
      })
    }

    const projects = await Promise.race([queryPromise, timeoutPromise])
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to load projects: ${message}` },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only super admins can create projects
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { systemRole: true },
    })

    if (user?.systemRole !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only super admins can create projects' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const project = await prisma.project.create({
      data: {
        name: body.name,
        description: body.description || null,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        emailFromName: body.emailFromName || null,
        emailFromAddress: body.emailFromAddress || null,
      },
    })
    return NextResponse.json(project)
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
