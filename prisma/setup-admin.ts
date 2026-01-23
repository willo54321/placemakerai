import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'williamj.neale@outlook.com'
  const password = 'admin123' // Change this after first login!

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      systemRole: 'SUPER_ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      systemRole: 'SUPER_ADMIN',
      name: 'William Neale',
    },
  })

  console.log('Admin user created/updated:', user.email)
  console.log('Password: admin123')
  console.log('\n⚠️  IMPORTANT: Change this password after first login!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
