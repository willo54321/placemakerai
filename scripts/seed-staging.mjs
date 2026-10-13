// Seed the STAGING database with a super-admin.
// Refuses to run against the production database or the local dev database.
//
//   npm run db:seed:staging   (sources .env.staging for DATABASE_URL)
//
// The generated password is appended as a comment to .env.staging (gitignored)
// rather than printed, so it never lands in a terminal transcript.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import fs from 'node:fs'

const url = process.env.DATABASE_URL || ''
if (!url) {
  console.error('DATABASE_URL is empty — paste the staging connection string into .env.staging first.')
  process.exit(1)
}
if (url.includes('wcycfjiagksjcxafcpma') || url.includes('eu-central-1')) {
  console.error('Refusing to seed: DATABASE_URL points at the PRODUCTION database.')
  process.exit(1)
}
if (url.includes('localhost') || url.includes('127.0.0.1')) {
  console.error('Refusing to seed: this is the local dev database — use `npm run db:seed`.')
  process.exit(1)
}

const prisma = new PrismaClient()
const email = 'wn6691049@gmail.com'
const password = crypto.randomBytes(12).toString('base64url')
const hash = await bcrypt.hash(password, 10)

await prisma.user.upsert({
  where: { email },
  update: { password: hash },
  create: {
    email,
    name: 'Will Neale',
    password: hash,
    systemRole: 'SUPER_ADMIN',
    emailVerified: new Date(),
  },
})

fs.appendFileSync('.env.staging', `\n# staging admin login: ${email} / ${password}\n`)
console.log(`Seeded staging super-admin ${email} — password appended as a comment to .env.staging`)
console.log('(re-running this script rotates the password)')
await prisma.$disconnect()
