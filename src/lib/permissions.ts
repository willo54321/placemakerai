import { getAuth } from './auth'
import { prisma } from './db'
import type { SystemRole, ProjectRole } from '@prisma/client'

export type Permission =
  | 'projects:create'
  | 'projects:read'
  | 'projects:update'
  | 'projects:delete'
  | 'users:manage'
  | 'users:invite'
  | 'analytics:view'
  | 'feedback:manage'
  | 'stakeholders:manage'
  | 'settings:manage'

// Permissions by system role
const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  SUPER_ADMIN: [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'users:manage',
    'users:invite',
    'analytics:view',
    'feedback:manage',
    'stakeholders:manage',
    'settings:manage',
  ],
  USER: [],
}

// Permissions by project role
const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  ADMIN: [
    'projects:read',
    'projects:update',
    'users:invite',
    'analytics:view',
    'feedback:manage',
    'stakeholders:manage',
    'settings:manage',
  ],
  CLIENT: [
    'projects:read',
    'analytics:view',
  ],
}

export interface UserProjectAccess {
  projectId: string
  role: ProjectRole
}

export interface AuthenticatedUser {
  id: string
  email: string
  name?: string | null
  systemRole: SystemRole
  projectAccess: UserProjectAccess[]
}

/**
 * Get the current authenticated user with their project access
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getAuth()
  if (!session?.user?.id) return null

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      systemRole: true,
      projectAccess: {
        select: {
          projectId: true,
          role: true,
        },
      },
    },
  })

  return user
}

/**
 * Check if user has a specific permission at system level
 */
export function hasSystemPermission(
  systemRole: SystemRole,
  permission: Permission
): boolean {
  return SYSTEM_ROLE_PERMISSIONS[systemRole].includes(permission)
}

/**
 * Check if user has a specific permission for a project
 */
export function hasProjectPermission(
  projectRole: ProjectRole | undefined,
  permission: Permission
): boolean {
  if (!projectRole) return false
  return PROJECT_ROLE_PERMISSIONS[projectRole].includes(permission)
}

/**
 * Check if user can access a specific project
 */
export async function canAccessProject(
  userId: string,
  projectId: string
): Promise<{ canAccess: boolean; role: ProjectRole | null; isAdmin: boolean }> {
  // Check if user is super admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  })

  if (user?.systemRole === 'SUPER_ADMIN') {
    return { canAccess: true, role: 'ADMIN', isAdmin: true }
  }

  // Check project-specific access
  const access = await prisma.projectAccess.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    select: { role: true },
  })

  if (!access) {
    return { canAccess: false, role: null, isAdmin: false }
  }

  return {
    canAccess: true,
    role: access.role,
    isAdmin: access.role === 'ADMIN',
  }
}

/**
 * Get all projects a user can access
 */
export async function getAccessibleProjects(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  })

  // Super admins can access all projects
  if (user?.systemRole === 'SUPER_ADMIN') {
    return prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
    })
  }

  // Regular users only see projects they have access to
  const projectAccess = await prisma.projectAccess.findMany({
    where: { userId },
    select: { projectId: true },
  })

  const projectIds = projectAccess.map((pa) => pa.projectId)

  return prisma.project.findMany({
    where: { id: { in: projectIds } },
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth() {
  const session = await getAuth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return session.user
}

/**
 * Require super admin role - throws if not super admin
 */
export async function requireSuperAdmin() {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Super Admin access required')
  }
  return user
}

/**
 * Require project access - throws if user cannot access project
 */
export async function requireProjectAccess(
  projectId: string,
  requiredRole?: ProjectRole
) {
  const session = await getAuth()
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }

  const access = await canAccessProject(session.user.id, projectId)

  if (!access.canAccess) {
    throw new Error('Forbidden: No access to this project')
  }

  // If a specific role is required, check it
  if (requiredRole === 'ADMIN' && !access.isAdmin) {
    throw new Error('Forbidden: Admin access required')
  }

  return { userId: session.user.id, ...access }
}
