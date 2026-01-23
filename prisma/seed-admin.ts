import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const superAdminEmail = 'williamj.neale@outlook.com'

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: superAdminEmail },
  })

  if (existingUser) {
    // Update existing user to super admin
    const updatedUser = await prisma.user.update({
      where: { email: superAdminEmail },
      data: { systemRole: 'SUPER_ADMIN' },
    })
    console.log(`Updated existing user ${updatedUser.email} to SUPER_ADMIN`)
  } else {
    // Create new super admin user
    const newUser = await prisma.user.create({
      data: {
        email: superAdminEmail,
        systemRole: 'SUPER_ADMIN',
      },
    })
    console.log(`Created new SUPER_ADMIN user: ${newUser.email}`)
  }

  console.log('Super admin setup complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
