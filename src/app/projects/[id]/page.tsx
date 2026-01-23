'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Users, MapPin, Inbox, Settings, Mail, LayoutDashboard, BarChart3, Navigation, Code, Eye } from 'lucide-react'
import Link from 'next/link'
import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { OverviewTab } from './overview'
import { StakeholderTab } from './stakeholders'
import { EnquiriesTab } from './enquiries'
import { SettingsTab } from './settings'
import { MailingListTab } from './mailing-list'
import { AnalyticsTab } from './analytics'
import { ToursTab } from './tours'
import UserMenu from '@/components/UserMenu'

// Dynamic imports for components that use Google Maps to avoid SSR/chunk issues
const FeedbackTab = dynamic(() => import('./feedback').then(mod => ({ default: mod.FeedbackTab })), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading feedback...</span>
      </div>
    </div>
  )
})

const EmbedSettingsTab = dynamic(() => import('./map').then(mod => ({ default: mod.EmbedSettingsTab })), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading embed settings...</span>
      </div>
    </div>
  )
})

type Tab = 'overview' | 'stakeholders' | 'feedback' | 'tours' | 'embed' | 'analytics' | 'inbox' | 'mailing' | 'settings'

// Tabs that require admin access
const ADMIN_ONLY_TABS: Tab[] = ['stakeholders', 'tours', 'embed', 'inbox', 'mailing', 'settings']

export default function ProjectPage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', params.id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${params.id}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch project')
      }
      return res.json()
    },
  })

  // User's role for this project (from API response)
  const userRole = project?._userRole as 'ADMIN' | 'CLIENT' | null
  const isAdmin = project?._isAdmin as boolean

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-slate-50">
        <div className="w-64 bg-white border-r border-slate-200 p-4">
          <div className="skeleton h-6 w-32 mb-6" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 p-8">
          <div className="skeleton h-8 w-64 mb-4" />
          <div className="skeleton h-4 w-96" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen bg-slate-50 items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            {error?.message === 'Forbidden' ? 'Access Denied' : 'Project not found'}
          </h2>
          <p className="text-slate-600 mb-4">
            {error?.message === 'Forbidden'
              ? "You don't have permission to access this project."
              : 'This project may have been deleted or you may not have access.'}
          </p>
          <Link href="/projects" className="btn-primary">
            <ArrowLeft size={18} aria-hidden="true" />
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  // Calculate combined feedback count
  const feedbackCount = (project.mapMarkers?.length || 0) + (project.publicPins?.length || 0) + (project.feedbackForms?.length || 0)

  const allTabs = [
    {
      id: 'overview' as Tab,
      label: 'Overview',
      icon: LayoutDashboard,
      count: 0,
      adminOnly: false,
    },
    {
      id: 'stakeholders' as Tab,
      label: 'Stakeholders',
      icon: Users,
      count: project.stakeholders?.length || 0,
      adminOnly: true,
    },
    {
      id: 'feedback' as Tab,
      label: 'Feedback',
      icon: MapPin,
      count: feedbackCount,
      adminOnly: false,
    },
    {
      id: 'tours' as Tab,
      label: 'Tours',
      icon: Navigation,
      count: project.tours?.length || 0,
      adminOnly: true,
    },
    {
      id: 'embed' as Tab,
      label: 'Embed',
      icon: Code,
      count: 0,
      adminOnly: true,
    },
    {
      id: 'analytics' as Tab,
      label: 'AI Analytics',
      icon: BarChart3,
      count: 0,
      adminOnly: false,
    },
    {
      id: 'inbox' as Tab,
      label: 'Inbox',
      icon: Inbox,
      count: project.enquiries?.length || 0,
      adminOnly: true,
    },
    {
      id: 'mailing' as Tab,
      label: 'Mailing List',
      icon: Mail,
      count: project.subscribers?.length || 0,
      adminOnly: true,
    },
    {
      id: 'settings' as Tab,
      label: 'Settings',
      icon: Settings,
      count: 0,
      adminOnly: true,
    },
  ]

  // Filter tabs based on user role - admins see all, clients see limited tabs
  const tabs = allTabs.filter(tab => isAdmin || !tab.adminOnly)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Skip link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Left Sidebar Navigation */}
      <aside className="w-64 min-w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        {/* Project Header */}
        <div className="p-4 border-b border-slate-200">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors mb-3"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            All Projects
          </Link>
          <h1 className="font-semibold text-slate-900 truncate" title={project.name}>
            {project.name}
          </h1>
          {project.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{project.description}</p>
          )}
          {/* Role indicator */}
          {userRole && (
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                isAdmin
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isAdmin ? (
                  <>
                    <Users size={10} />
                    Admin
                  </>
                ) : (
                  <>
                    <Eye size={10} />
                    View Only
                  </>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3" aria-label="Project sections">
          <ul className="space-y-1" role="tablist">
            {tabs.map(tab => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`${tab.id}-panel`}
                  id={`${tab.id}-tab`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-green-50 text-green-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <tab.icon size={18} aria-hidden="true" className={activeTab === tab.id ? 'text-green-600' : ''} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        activeTab === tab.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                      aria-label={`${tab.count} ${tab.label.toLowerCase()}`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer with User Menu */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <UserMenu />
          <div className="text-xs text-slate-400">
            Last updated: {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main id="main-content" className="flex-1 overflow-auto">
        <div
          role="tabpanel"
          id={`${activeTab}-panel`}
          aria-labelledby={`${activeTab}-tab`}
          className="h-full"
        >
          {activeTab === 'overview' && (
            <div className="p-6">
              <OverviewTab project={project} onNavigate={setActiveTab} />
            </div>
          )}
          {activeTab === 'stakeholders' && (
            <div className="p-6">
              <StakeholderTab projectId={params.id} stakeholders={project.stakeholders} />
            </div>
          )}
          {activeTab === 'feedback' && (
            <FeedbackTab projectId={params.id} project={project} />
          )}
          {activeTab === 'tours' && (
            <div className="p-6">
              <ToursTab projectId={params.id} project={project} />
            </div>
          )}
          {activeTab === 'embed' && (
            <div className="p-6">
              <EmbedSettingsTab projectId={params.id} project={project} />
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="p-6">
              <AnalyticsTab projectId={params.id} />
            </div>
          )}
          {activeTab === 'inbox' && (
            <div className="p-6">
              <EnquiriesTab projectId={params.id} project={project} />
            </div>
          )}
          {activeTab === 'mailing' && (
            <div className="p-6">
              <MailingListTab projectId={params.id} />
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-6">
              <SettingsTab projectId={params.id} project={project} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
