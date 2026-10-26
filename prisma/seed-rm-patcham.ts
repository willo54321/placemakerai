/**
 * Seed script for the Royal Mail Patcham project — the live construction
 * issue-reporting map behind the Brighton Delivery Office construction website.
 *
 * The client site (Documents/RM Patcham construction website, hosted on
 * Hostinger) iframes `/embed/cmmkjinxt0000hsj72ivalz84/issues`. That project
 * record was lost in a database move, so this recreates it under the SAME id
 * and the existing embed starts working again without a client-side redeploy.
 *
 * Project settings only — no fabricated pins, enquiries or stakeholders. The
 * script is idempotent (upsert) and never deletes children, so it is safe to
 * re-run on a database that already holds real reports.
 *
 * Run locally:    npx tsx prisma/seed-rm-patcham.ts
 * Run on prod:    npm run seed:rmpatcham:prod   (user runs this)
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Fixed: must match the iframe src on the client website.
const PROJECT_ID = 'cmmkjinxt0000hsj72ivalz84'

// Patcham Court Farm, Vale Avenue, Brighton BN1 8YF (OSM geocode).
const CENTRE = { lat: 50.8673, lng: -0.1514 }

async function main() {
  console.log('Seeding "Royal Mail Brighton Delivery Office (Patcham)"…')

  const projectData = {
    name: 'Royal Mail Brighton Delivery Office (Patcham)',
    description:
      'Construction of the new Royal Mail Brighton Delivery Office at Patcham Court Farm, Vale Avenue, Patcham. Construction-phase community relations: residents report noise, dust, traffic and other site issues via the map on the project website.',
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
