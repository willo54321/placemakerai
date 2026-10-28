'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  FolderOpen,
  Users,
  Inbox,
  ScrollText,
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
  { label: 'Messages', href: '/admin/messages', icon: Inbox, adminOnly: true },
  { label: 'Audit & usage', href: '/admin/audit', icon: ScrollText, adminOnly: true },
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
        <div className="w-9 h-9 bg-white rounded-[10px] flex items-center justify-center shadow-[0_1px_2px_rgba(0,0,0,0.18),0_4px_10px_-2px_rgba(0,0,0,0.18)]">
          <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] text-brand-700" aria-hidden="true">
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Zm0 9.75a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5Z"
            />
          </svg>
        </div>
        <span className="text-lg font-semibold tracking-[-0.015em] text-white">Placemaker</span>
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
      <div className="p-4 border-t border-white/10">
        <UserMenu />
      </div>
    </aside>
  )
}
