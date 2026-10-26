/**
 * Seed script for the Royal Mail Patcham project — the live construction
 * issue-reporting map behind the Brighton Delivery Office construction website.
 *
 * The client site (Documents/RM Patcham construction website, hosted on
 * Hostinger) iframes `/embed/cmmkjinxt0000hsj72ivalz84/issues`. That project
 * record was lost in a database move, so this recreates it under the SAME id
 * and the existing embed starts working again without a client-side redeploy.
 *
 * Project settings plus the project's REAL elected representatives (the
 * Brighton Pavilion MP and the Patcham & Hollingbury councillors, resolved live
 * from the project coordinates via src/lib/representatives.ts). Nothing is
 * fabricated here — sample enquiries and issue reports live in
 * seed-rm-patcham-samples.ts. Idempotent (upsert; the representative import
 * skips people already on the register) and never deletes children, so it is
 * safe to re-run on a database that already holds real reports.
 *
 * Run locally:    npx tsx prisma/seed-rm-patcham.ts
 * Run on prod:    npm run seed:rmpatcham:prod   (user runs this)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { importRepresentativesForProject } from '../src/lib/import-representatives'

const prisma = new PrismaClient()

// Fixed: must match the iframe src on the client website.
const PROJECT_ID = 'cmmkjinxt0000hsj72ivalz84'

// The new delivery/sorting office site: Patcham Court Farm, between Vale
// Avenue and the A23 London Road, just south of the A27 (Brighton BN1 8YF).
const CENTRE = { lat: 50.8678, lng: -0.1505 }

async function main() {
  console.log('Seeding "Royal Mail Brighton Delivery Office (Patcham)"…')

  const projectData = {
    name: 'Royal Mail Brighton Delivery Office (Patcham)',
    description:
      'Construction of the new Royal Mail Brighton Delivery Office (sorting and delivery hub) on the former Patcham Court Farm site, Vale Avenue, Patcham. Construction-phase community relations: residents report noise, dust, traffic and other site issues via the map on the project website.',
    latitude: CENTRE.lat,
    longitude: CENTRE.lng,
    mapZoom: 17,
    status: 'LIVE' as const,
    embedEnabled: true,
    allowPins: true,
    allowDrawing: false,
    issuesEnabled: true,
    // Project mailbox run by SEC Newgate — same address the website shows for
    // direct contact. Every new issue report emails it.
    issueNotifyEmails: 'royalmailpatcham@secnewgate.co.uk',
    // Royal Mail Red (BRAND_GUIDELINES.md). RM First Class is a licensed font,
    // not on Google Fonts, so embedFontFamily is left at the platform default.
    embedPrimaryColor: '#da202a',
    embedDefaultSatellite: true,
  }

  const project = await prisma.project.upsert({
    where: { id: PROJECT_ID },
    update: projectData,
    create: { id: PROJECT_ID, ...projectData },
  })

  // Project sending address (skip silently if taken by another project)
  try {
    await prisma.project.update({ where: { id: PROJECT_ID }, data: { emailLocalPart: 'royalmailpatcham' } })
  } catch {
    console.log('emailLocalPart "royalmailpatcham" unavailable — left unset')
  }

  // Give every super admin access (idempotent); other team members are added in the UI
  const admins = await prisma.user.findMany({ where: { systemRole: 'SUPER_ADMIN' } })
  for (const admin of admins) {
    await prisma.projectAccess.upsert({
      where: { userId_projectId: { userId: admin.id, projectId: PROJECT_ID } },
      create: { userId: admin.id, projectId: PROJECT_ID, role: 'ADMIN' },
      update: { role: 'ADMIN' },
    })
  }

  // Real elected representatives onto the stakeholder register (MP + ward
  // councillors, from the Parliament Members API and the council's ModernGov
  // service). Skips anyone already registered, so reruns add nothing.
  const reps = await importRepresentativesForProject(PROJECT_ID)
  if (reps) {
    console.log(
      `  representatives: ${reps.imported} imported, ${reps.skipped} already present` +
        ` (MP ${reps.mp ?? '—'}, ${reps.councillors} councillors, ${reps.ward ?? ''} / ${reps.constituency ?? ''})`
    )
  } else {
    console.log('  representatives: lookup unavailable — add via the Stakeholders tab')
  }

  const base = process.env.NEXTAUTH_URL || 'http://localhost:3002'
  console.log(`Done: ${project.name} (${project.id})`)
  console.log(`  admins granted: ${admins.length}`)
  console.log(`  issues embed:   ${base}/embed/${project.id}/issues`)
  console.log(`  dashboard:      ${base}/projects/${project.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
