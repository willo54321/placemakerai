import { NextResponse } from 'next/server'
import type { ProjectRole } from '@prisma/client'
import { requireProjectAccess, requireSuperAdmin } from './permissions'

/**
 * Authorize the current user for a project inside an API route handler.
 *
 * Returns a NextResponse (401/403) that the caller should return immediately
 * when the user is not authorized, or `null` when access is granted.
 *
 * Usage:
 *   const denied = await authorizeProject(params.id, 'ADMIN')
 *   if (denied) return denied
 */
export async function authorizeProject(projectId: string, role?: ProjectRole) {
  try {
    await requireProjectAccess(projectId, role)
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    const status = message.startsWith('Forbidden') ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }
}

/**
 * Require the current user to be a SUPER_ADMIN inside an API route handler.
 * Returns a NextResponse (401/403) to return, or `null` when authorized.
 */
export async function authorizeSuperAdmin() {
  try {
    await requireSuperAdmin()
    return null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unauthorized'
    const status = message.startsWith('Forbidden') ? 403 : 401
    return NextResponse.json({ error: message }, { status })
  }
}
