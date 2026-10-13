// Delete everything the stress test created in the staging database.
//
//   set -a && . ./.env.staging && set +a && node scripts/stress-cleanup.mjs
import { PrismaClient } from '@prisma/client'

const url = process.env.DATABASE_URL || ''
if (url.includes('wcycfjiagksjcxafcpma') || url.includes('eu-central-1')) {
  console.error('Refusing to run against the PRODUCTION database.')
  process.exit(1)
}

const prisma = new PrismaClient()

const pins = await prisma.publicPin.deleteMany({
  where: { comment: { startsWith: '[stress-test]' } },
})
const enquiries = await prisma.enquiry.deleteMany({
  where: { subject: { startsWith: '[stress-test]' } },
})
const responses = await prisma.feedbackResponse.deleteMany({
  where: { formId: 'stress-test-form' },
})

console.log(`Deleted: ${pins.count} pins, ${enquiries.count} enquiries, ${responses.count} form responses`)
await prisma.$disconnect()
