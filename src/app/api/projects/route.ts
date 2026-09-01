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

    // Constrain to the projects the caller may see; super admins see all.
    let projectFilter: { id: { in: string[] } } | undefined
    if (user?.systemRole !== 'SUPER_ADMIN') {
      const projectAccess = await prisma.projectAccess.findMany({
        where: { userId: session.user.id },
        select: { projectId: true },
      })
      projectFilter = { id: { in: projectAccess.map((pa) => pa.projectId) } }
    }

    const queryPromise = prisma.project.findMany({
      where: projectFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { feedbackForms: true, publicPins: true, enquiries: true },
        },
        // Response totals ride along on the forms so we don't N+1.
        feedbackForms: { select: { _count: { select: { responses: true } } } },
      },
    })

    const projects = (await Promise.race([queryPromise, timeoutPromise])) as Array<{
      id: string
      name: string
      description: string | null
      latitude: number | null
      longitude: number | null
      mapZoom: number | null
      embedEnabled: boolean
      createdAt: Date
      updatedAt: Date
      _count: { feedbackForms: number; publicPins: number; enquiries: number }
      feedbackForms: Array<{ _count: { responses: number } }>
    }>

    const ids = projects.map((p) => p.id)

    // Enrichment in three grouped queries (indexed; no per-project round-trips):
    // pending moderation count, and the most recent pin / enquiry as an activity
    // signal.
    const [pendingGroups, lastPinGroups, lastEnquiryGroups] = await Promise.all([
      prisma.publicPin.groupBy({
        by: ['projectId'],
        where: { projectId: { in: ids }, approved: false },
        _count: { _all: true },
      }),
      prisma.publicPin.groupBy({
        by: ['projectId'],
        where: { projectId: { in: ids } },
        _max: { createdAt: true },
      }),
      prisma.enquiry.groupBy({
        by: ['projectId'],
        where: { projectId: { in: ids } },
        _max: { createdAt: true },
      }),
    ])

    const pendingBy = new Map(pendingGroups.map((g) => [g.projectId, g._count._all]))
    const lastPinBy = new Map(lastPinGroups.map((g) => [g.projectId, g._max.createdAt]))
    const lastEnquiryBy = new Map(lastEnquiryGroups.map((g) => [g.projectId, g._max.createdAt]))

    const enriched = projects.map((p) => {
      const times = [lastPinBy.get(p.id), lastEnquiryBy.get(p.id)].filter(Boolean) as Date[]
      const lastActivity = times.length
        ? new Date(Math.max(...times.map((t) => t.getTime())))
        : null
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        latitude: p.latitude,
        longitude: p.longitude,
        embedEnabled: p.embedEnabled,
        stats: {
          mapComments: p._count.publicPins,
          forms: p._count.feedbackForms,
          responses: p.feedbackForms.reduce((sum, f) => sum + f._count.responses, 0),
          enquiries: p._count.enquiries,
        },
        pendingPins: pendingBy.get(p.id) ?? 0,
        lastActivity,
      }
    })

    return NextResponse.json(enriched)
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
