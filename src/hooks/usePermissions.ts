'use client'

import { useSession } from 'next-auth/react'

// Hook for easy permission checking in components
// Note: For project-specific permissions, use useProjectPermissions instead
export function usePermissions() {
  const { data: session, status } = useSession()

  const systemRole = session?.user?.systemRole || 'USER'
  const isSuperAdmin = systemRole === 'SUPER_ADMIN'

  return {
    // Loading state
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',

    // System-level permissions
    systemRole,
    isSuperAdmin,

    // Permission checks (super admins can do everything)
    canCreateProject: isSuperAdmin,
    canDeleteProject: isSuperAdmin,
    canManageUsers: isSuperAdmin,

    // Legacy compatibility - these default to super admin access
    // For project-specific checks, use useProjectPermissions hook
    role: isSuperAdmin ? 'admin' : 'user',
    isAdmin: isSuperAdmin,
    isViewer: false,
    canEdit: isSuperAdmin,
    canManageForms: isSuperAdmin,
    canManageStakeholders: isSuperAdmin,
    canManageSettings: isSuperAdmin,
    canViewAnalytics: true,
    canViewFeedback: true,
  }
}

// Hook for project-specific permissions
export function useProjectPermissions(projectRole?: 'ADMIN' | 'CLIENT' | null, isProjectAdmin?: boolean) {
  const { isSuperAdmin } = usePermissions()

  const isAdmin = isSuperAdmin || isProjectAdmin || projectRole === 'ADMIN'
  const isClient = projectRole === 'CLIENT'

  return {
    projectRole,
    isAdmin,
    isClient,

    // Project-specific permission checks
    canEditProject: isAdmin,
    canManageStakeholders: isAdmin,
    canManageForms: isAdmin,
    canManageSettings: isAdmin,
    canViewAnalytics: true, // Both admin and client can view
    canViewFeedback: true, // Both admin and client can view
  }
}
