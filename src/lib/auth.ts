import { NextAuthOptions, getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import type { SystemRole } from '@prisma/client'

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      systemRole: SystemRole
    }
  }
  interface User {
    systemRole?: SystemRole
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    systemRole?: SystemRole
  }
}

export const authOptions: NextAuthOptions = {
  // Note: No adapter for Credentials provider - we handle user lookup manually
  session: {
    strategy: 'jwt', // Use JWT so middleware works on edge runtime
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password) {
          throw new Error('Invalid email or password')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error('Invalid email or password')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          systemRole: user.systemRole,
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
    verifyRequest: '/verify',
    newUser: '/onboarding',
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign in, add user data to token
      if (user) {
        token.id = user.id
        token.systemRole = user.systemRole || 'USER'
      }
      return token
    },
    async session({ session, token }) {
      // Add user id and role to session from JWT
      if (token) {
        session.user.id = token.id as string
        session.user.systemRole = (token.systemRole as SystemRole) || 'USER'
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // After sign in, redirect to home or the intended page
      if (url.startsWith(baseUrl)) return url
      if (url.startsWith('/')) return `${baseUrl}${url}`
      return baseUrl
    },
  },
}

export const getAuth = () => getServerSession(authOptions)
