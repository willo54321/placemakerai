import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/verify',
  '/api/auth',
  '/embed',
  '/api/embed',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Allow static files and images
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next()
  }

  // Check for auth token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  // Protected routes check
  const isProtectedRoute =
    pathname.startsWith('/projects') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/projects') ||
    pathname.startsWith('/api/admin')

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Home page redirect
  if (pathname === '/') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.redirect(new URL('/projects', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
}
