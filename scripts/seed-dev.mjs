// Seed the LOCAL dev database with a super-admin so you can log in.
// Refuses to run against anything that isn't localhost.
//
//   npm run db:seed        →  dev@placemaker.local / devpassword
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const url = process.env.DATABASE_URL || ''
if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
  console.error('Refusing to seed: DATABASE_URL is not a localhost database.')
  process.exit(1)
}

const prisma = new PrismaClient()
const email = 'dev@placemaker.local'

await prisma.user.upsert({
  where: { email },
  update: {},
  create: {
    email,
    name: 'Dev Admin',
    password: await bcrypt.hash('devpassword', 10),
    systemRole: 'SUPER_ADMIN',
    emailVerified: new Date(),
  },
})

console.log(`Seeded super-admin: ${email} / devpassword`)
await prisma.$disconnect()
