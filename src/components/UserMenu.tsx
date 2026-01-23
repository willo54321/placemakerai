'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { User, Shield, ChevronDown, LogOut, Users } from 'lucide-react'

const ROLE_CONFIG = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-purple-600', icon: Shield },
  USER: { label: 'User', color: 'bg-slate-500', icon: User },
}

export default function UserMenu() {
  const { data: session, status } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200">
        <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
        <div className="w-16 h-4 bg-slate-200 rounded animate-pulse" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
      >
        <User className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-medium text-slate-700">Sign In</span>
      </Link>
    )
  }

  const systemRole = session.user.systemRole || 'USER'
  const roleConfig = ROLE_CONFIG[systemRole]
  const Icon = roleConfig.icon

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200 w-full"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className={`w-6 h-6 rounded-full ${roleConfig.color} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-medium text-slate-700 truncate flex-1 text-left">
          {session.user.name || session.user.email?.split('@')[0]}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
          {/* User info */}
          <div className="px-4 py-2 border-b border-slate-100">
            <p className="text-sm font-medium text-slate-900 truncate">
              {session.user.name || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
              systemRole === 'SUPER_ADMIN'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {roleConfig.label}
            </span>
          </div>

          {/* Menu options */}
          <div className="py-1">
            {systemRole === 'SUPER_ADMIN' && (
              <Link
                href="/admin/users"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Users className="w-4 h-4" />
                Manage Users
              </Link>
            )}
            <button
              onClick={() => {
                setIsOpen(false)
                signOut({ callbackUrl: '/login' })
              }}
              className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
