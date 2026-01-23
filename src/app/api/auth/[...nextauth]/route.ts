import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Force Node.js runtime since Prisma doesn't work on Edge
export const runtime = 'nodejs'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
