import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'
import { lookupRepresentatives, Representative } from '@/lib/representatives'

export interface ImportSummary {
  imported: number
  skipped: number
  mp: string | null
  councillors: number
  constituency: string | null
  district: string | null
  ward: string | null
}

/**
 * Seed a project's stakeholder register with its elected representatives —
 * the constituency MP and every councillor of the local authority — resolved
 * from the project's coordinates. Idempotent: stakeholders that already exist
 * (matched by email, or by name when there's no email) are skipped, so it's
 * safe to run on creation and again from the Stakeholders tab.
 */
export async function importRepresentativesForProject(
  projectId: string
): Promise<ImportSummary | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { latitude: true, longitude: true },
  })
  if (project?.latitude == null || project?.longitude == null) return null

  const result = await lookupRepresentatives(project.latitude, project.longitude)
  if (!result || (!result.mp && result.councillors.length === 0)) return null

  const existing = await prisma.stakeholder.findMany({
    where: { projectId },
    select: { name: true, email: true },
  })
  const seenEmails = new Set(
    existing.map(s => s.email?.toLowerCase()).filter((e): e is string => Boolean(e))
  )
  const seenNames = new Set(existing.map(s => s.name.toLowerCase()))

  const candidates: Array<{ rep: Representative; influence: number; source: string }> = []
  if (result.mp) {
    candidates.push({
      rep: result.mp,
      influence: 5,
      source: 'UK Parliament Members API',
    })
  }
  for (const councillor of result.councillors) {
    candidates.push({ rep: councillor, influence: 4, source: result.councilSource ?? 'council democracy site' })
  }

  const rows = []
  let skipped = 0
  for (const { rep, influence, source } of candidates) {
    const emailKey = rep.email?.toLowerCase()
    const nameKey = rep.name.toLowerCase()
    if ((emailKey && seenEmails.has(emailKey)) || seenNames.has(nameKey)) {
      skipped++
      continue
    }
    if (emailKey) seenEmails.add(emailKey)
    seenNames.add(nameKey)
    rows.push({
      projectId,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      organization: rep.organization,
      role: rep.party ? `${rep.role} (${rep.party})` : rep.role,
      type: 'authority',
      influence,
      notes: `Auto-imported from ${source} — verify contact details before use.`,
    })
  }

  if (rows.length > 0) {
    await prisma.stakeholder.createMany({ data: rows })
  }

  await logAudit({
    projectId,
    action: 'stakeholder.import',
    targetType: 'Project',
    targetId: projectId,
    detail: {
      imported: rows.length,
      skipped,
      constituency: result.constituency,
      district: result.district,
    },
  })

  return {
    imported: rows.length,
    skipped,
    mp: result.mp?.name ?? null,
    councillors: result.councillors.length,
    constituency: result.constituency,
    district: result.district,
    ward: result.ward,
  }
}
