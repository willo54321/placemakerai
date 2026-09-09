// One-off: give every existing project a sending address derived from its
// name, same rules as project creation. Skips projects that already have one.
// Run with: npx tsx scripts/backfill-email-local-parts.ts
import { PrismaClient } from '@prisma/client'
import { deriveEmailLocalPart } from '../src/lib/email-identity'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, emailLocalPart: true },
    orderBy: { createdAt: 'asc' },
  })

  const taken = new Set(
    projects.map((p) => p.emailLocalPart).filter((v): v is string => Boolean(v))
  )

  for (const project of projects) {
    if (project.emailLocalPart) {
      console.log(`skip     ${project.name} — already ${project.emailLocalPart}`)
      continue
    }
    const base = deriveEmailLocalPart(project.name)?.slice(0, 60)
    if (!base) {
      console.log(`skip     ${project.name} — no usable characters in name`)
      continue
    }
    let localPart = base
    for (let n = 2; taken.has(localPart); n++) localPart = `${base}${n}`
    taken.add(localPart)

    await prisma.project.update({
      where: { id: project.id },
      data: { emailLocalPart: localPart },
    })
    console.log(`set      ${project.name} -> ${localPart}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
