import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { authorizeProject } from '@/lib/api-auth'
import { importRepresentativesForProject } from '@/lib/import-representatives'

// External lookups (postcodes.io, Parliament, ModernGov) can be slow.
export const maxDuration = 60

// POST - Seed the stakeholder register with the project's MP and councillors,
// resolved from the project's coordinates. Idempotent; requires ADMIN.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { latitude: true, longitude: true },
  })
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (project.latitude == null || project.longitude == null) {
    return NextResponse.json(
      { error: 'Set the project location first — representatives are looked up from its coordinates' },
      { status: 400 }
    )
  }

  const summary = await importRepresentativesForProject(params.id)
  if (!summary) {
    return NextResponse.json(
      { error: 'Could not resolve representatives for this location' },
      { status: 502 }
    )
  }

  return NextResponse.json(summary)
}
