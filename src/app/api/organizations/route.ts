import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Get user's organizations
export async function GET() {
  const session = await getAuth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: session.user.id },
    include: {
      organization: {
        include: {
          _count: {
            select: { projects: true, members: true },
          },
        },
      },
    },
  })

  const organizations = memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }))

  return NextResponse.json(organizations)
}

// Create new organization
export async function POST(request: Request) {
  const session = await getAuth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, slug } = await request.json()

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  // Check if slug is already taken
  const existingOrg = await prisma.organization.findUnique({
    where: { slug },
  })

  if (existingOrg) {
    return NextResponse.json({ error: 'This URL is already taken' }, { status: 400 })
  }

  // Create organization and add user as owner
  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId: session.user.id,
          role: 'owner',
        },
      },
    },
    include: {
      members: true,
    },
  })

  return NextResponse.json(organization)
}
