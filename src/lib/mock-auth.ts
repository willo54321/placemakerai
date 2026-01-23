// Mock authentication for testing different access levels
// This will be replaced with real auth later

export type UserRole = 'admin' | 'user' | 'viewer'

export interface MockUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export const MOCK_USERS: Record<UserRole, MockUser> = {
  admin: {
    id: 'admin-001',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
  },
  user: {
    id: 'user-001',
    name: 'Regular User',
    email: 'user@example.com',
    role: 'user',
  },
  viewer: {
    id: 'viewer-001',
    name: 'Viewer',
    email: 'viewer@example.com',
    role: 'viewer',
  },
}

// Role permissions
export const PERMISSIONS = {
  admin: {
    canCreateProject: true,
    canDeleteProject: true,
    canEditProject: true,
    canManageStakeholders: true,
    canManageForms: true,
    canViewAnalytics: true,
    canManageTeam: true,
    canExportData: true,
  },
  user: {
    canCreateProject: true,
    canDeleteProject: false,
    canEditProject: true,
    canManageStakeholders: true,
    canManageForms: true,
    canViewAnalytics: true,
    canManageTeam: false,
    canExportData: true,
  },
  viewer: {
    canCreateProject: false,
    canDeleteProject: false,
    canEditProject: false,
    canManageStakeholders: false,
    canManageForms: false,
    canViewAnalytics: true,
    canManageTeam: false,
    canExportData: false,
  },
}

export function getStoredRole(): UserRole {
  if (typeof window === 'undefined') return 'admin'
  return (localStorage.getItem('mockRole') as UserRole) || 'admin'
}

export function setStoredRole(role: UserRole): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('mockRole', role)
}

export function getMockUser(): MockUser {
  const role = getStoredRole()
  return MOCK_USERS[role]
}

export function getPermissions(role: UserRole) {
  return PERMISSIONS[role]
}
