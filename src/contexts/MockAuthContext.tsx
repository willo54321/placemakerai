'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import {
  UserRole,
  MockUser,
  MOCK_USERS,
  PERMISSIONS,
  getStoredRole,
  setStoredRole
} from '@/lib/mock-auth'

interface MockAuthContextType {
  user: MockUser
  role: UserRole
  setRole: (role: UserRole) => void
  permissions: typeof PERMISSIONS.admin
}

const MockAuthContext = createContext<MockAuthContextType | null>(null)

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('admin')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setRoleState(getStoredRole())
    setMounted(true)
  }, [])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    setStoredRole(newRole)
  }

  const value: MockAuthContextType = {
    user: MOCK_USERS[role],
    role,
    setRole,
    permissions: PERMISSIONS[role],
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <MockAuthContext.Provider value={{
        user: MOCK_USERS.admin,
        role: 'admin',
        setRole: () => {},
        permissions: PERMISSIONS.admin,
      }}>
        {children}
      </MockAuthContext.Provider>
    )
  }

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  )
}

export function useMockAuth() {
  const context = useContext(MockAuthContext)
  if (!context) {
    throw new Error('useMockAuth must be used within a MockAuthProvider')
  }
  return context
}
