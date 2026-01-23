'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen,
  MapPin,
  Users,
  LucideIcon,
} from 'lucide-react'
import UserMenu from './UserMenu'
import { usePermissions } from '@/hooks/usePermissions'

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  badge?: number
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Projects', href: '/projects', icon: FolderOpen },
  { label: 'Users', href: '/admin/users', icon: Users, adminOnly: true },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isSuperAdmin } = usePermissions()

  // Filter nav items based on permissions
  const visibleNavItems = navItems.filter(item => !item.adminOnly || isSuperAdmin)

  return (
    <aside className="sidebar flex flex-col">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-semibold text-slate-900">Placemaker.ai</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav flex-1">
        <ul className="space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href))
            const Icon = item.icon

            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={isActive ? 'sidebar-item-active' : 'sidebar-item'}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="sidebar-badge">{item.badge}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Menu at bottom */}
      <div className="p-4 border-t border-slate-200">
        <UserMenu />
      </div>
    </aside>
  )
}
