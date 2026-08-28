'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Users, MapPin, Settings, LayoutDashboard, BarChart3, Globe, Eye, FileText, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { OverviewTab } from './overview'
import { SettingsTab } from './settings'
import { AnalyticsTab } from './analytics'
import { HowToTab } from './how-to'
import UserMenu from '@/components/UserMenu'
import { ProductTour, type TourStep } from '@/components/ProductTour'

// Per-tab tour copy; steps are assembled from the tabs the user can see.
const TOUR_COPY: Record<Tab, { title: string; body: string }> = {
  overview: {
    title: 'Overview & activity',
    body: 'Your at-a-glance summary. The activity feed shows every new piece of feedback the moment residents submit it — with links straight to each item.',
  },
  feedback: {
    title: 'Map feedback',
    body: 'The interactive map and the moderation queue. Comments from the public appear here first — approve them to publish them on the map.',
  },
  forms: {
    title: 'Feedback forms',
    body: 'Build custom survey forms, share their public link, and read responses as they come in.',
  },
  website: {
    title: 'Your website embed',
    body: 'Grab the embed code to put the consultation map on any website, and customise its colours and behaviour.',
  },
  analytics: {
    title: 'AI analytics',
    body: 'AI-powered analysis of all feedback: sentiment, themes, material planning considerations, and report-ready summaries.',
  },
  settings: {
    title: 'Settings',
    body: 'Project details, location, and configuration live here.',
  },
  howto: {
    title: 'How to',
    body: 'Step-by-step guides for every common task — approving comments, building forms, embedding the map. If you’re ever stuck, start here. That’s the tour!',
  },
}

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
        <span className="text-sm text-slate-500">Loading website settings...</span>
      </div>
    </div>
  )
})

const FormsTabWrapper = dynamic(() => import('./forms-wrapper').then(mod => ({ default: mod.FormsTabWrapper })), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading forms...</span>
      </div>
    </div>
  )
})

type Tab = 'overview' | 'feedback' | 'forms' | 'website' | 'analytics' | 'settings' | 'howto'

// Deep-link target passed alongside a tab switch (e.g. from the activity
// feed): jump straight to a specific pin or form response.
export type FocusItem =
  | { kind: 'pin'; id: string }
  | { kind: 'response'; formId: string; responseId: string }

// Tab groups for organized navigation
type TabGroup = {
  id: string
  label: string
  tabs: Tab[]
}

const tabGroups: TabGroup[] = [
  { id: 'top', label: '', tabs: ['overview'] },
  { id: 'collect', label: 'Collect', tabs: ['feedback', 'forms', 'analytics'] },
  { id: 'publish', label: 'Publish', tabs: ['website'] },
  { id: 'configure', label: 'Configure', tabs: ['settings'] },
  { id: 'help', label: 'Help', tabs: ['howto'] },
]

export default function ProjectPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [focusItem, setFocusItem] = useState<FocusItem | null>(null)

  const navigateTo = (tab: Tab, focus?: FocusItem) => {
    setFocusItem(focus ?? null)
    setActiveTab(tab)
  }

  // Product tour: shown when the user's flag is on and not yet dismissed
  // this session. "Don't show again" persists the opt-out. forceTour lets
  // the How To page replay it on demand.
  const [tourDismissed, setTourDismissed] = useState(false)
  const [forceTour, setForceTour] = useState(false)
  const { data: tourStatus } = useQuery({
    queryKey: ['tour-status'],
    queryFn: () => fetch('/api/me/tour').then(r => r.json()),
  })

  const finishTour = (dontShowAgain: boolean) => {
    setTourDismissed(true)
    setForceTour(false)
    setActiveTab('overview')
    if (dontShowAgain) {
      fetch('/api/me/tour', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showTour: false }),
      }).catch(() => {})
    }
  }

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

  // Calculate counts for different feedback types
  const pinFeedbackCount = project.publicPins?.length || 0
  const formResponseCount = project.feedbackForms?.reduce((sum: number, form: any) => sum + (form._count?.responses || form.responses?.length || 0), 0) || 0

  const allTabs = [
    {
      id: 'overview' as Tab,
      label: 'Overview',
      icon: LayoutDashboard,
      count: 0,
      adminOnly: false,
    },
    {
      id: 'feedback' as Tab,
      label: 'Map Feedback',
      icon: MapPin,
      count: pinFeedbackCount,
      adminOnly: false,
    },
    {
      id: 'forms' as Tab,
      label: 'Feedback Forms',
      icon: FileText,
      count: formResponseCount,
      adminOnly: true,
    },
    {
      id: 'website' as Tab,
      label: 'Website',
      icon: Globe,
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
      id: 'settings' as Tab,
      label: 'Settings',
      icon: Settings,
      count: 0,
      adminOnly: true,
    },
    {
      id: 'howto' as Tab,
      label: 'How To',
      icon: HelpCircle,
      count: 0,
      adminOnly: false,
    },
  ]

  // Create a map for easy lookup
  const tabsMap = new Map(allTabs.map(tab => [tab.id, tab]))

  // Tour steps: a welcome card, then one step per tab this user can see
  const firstName = session?.user?.name?.split(' ')[0]
  const tourSteps: TourStep[] = [
    {
      targetId: null,
      title: firstName ? `Welcome to Placemaker, ${firstName}` : 'Welcome to Placemaker',
      body: `A 30-second tour of your ${project.name} dashboard. You can close it any time, or tick "don’t show again".`,
    },
    ...allTabs
      .filter(tab => isAdmin || !tab.adminOnly)
      .map(tab => ({
        targetId: `${tab.id}-tab`,
        title: TOUR_COPY[tab.id].title,
        body: TOUR_COPY[tab.id].body,
      })),
  ]
  const showTour = forceTour || (Boolean(tourStatus?.showTour) && !tourDismissed)

  return (
    <div className="flex min-h-screen bg-slate-50">
      {showTour && (
        <ProductTour
          steps={tourSteps}
          onFinish={finishTour}
          onStepChange={(i) => {
            // Show each feature as the tour narrates it (step 0 is the welcome card)
            const target = tourSteps[i]?.targetId
            if (target) setActiveTab(target.replace('-tab', '') as Tab)
          }}
        />
      )}
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
        <nav className="flex-1 p-3 overflow-y-auto" aria-label="Project sections">
          {tabGroups.map((group, groupIndex) => {
            // Get visible tabs for this group
            const groupTabs = group.tabs
              .map(tabId => tabsMap.get(tabId))
              .filter((tab): tab is NonNullable<typeof tab> =>
                tab !== undefined && (isAdmin || !tab.adminOnly)
              )

            if (groupTabs.length === 0) return null

            return (
              <div key={group.id} className={groupIndex > 0 ? 'mt-6' : ''}>
                {group.label && (
                  <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {group.label}
                  </p>
                )}
                <ul className="space-y-1" role="tablist">
                  {groupTabs.map(tab => (
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
              </div>
            )
          })}
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
              <OverviewTab project={project} onNavigate={navigateTo} />
            </div>
          )}
          {activeTab === 'feedback' && (
            <FeedbackTab
              projectId={params.id}
              project={project}
              focusPinId={focusItem?.kind === 'pin' ? focusItem.id : null}
              onFocusHandled={() => setFocusItem(null)}
            />
          )}
          {activeTab === 'forms' && (
            <FormsTabWrapper
              projectId={params.id}
              project={project}
              focusResponse={focusItem?.kind === 'response' ? focusItem : null}
              onFocusHandled={() => setFocusItem(null)}
            />
          )}
          {activeTab === 'website' && (
            <div className="p-6">
              <EmbedSettingsTab projectId={params.id} project={project} />
            </div>
          )}
          {activeTab === 'analytics' && (
            <div className="p-6">
              <AnalyticsTab projectId={params.id} />
            </div>
          )}
          {activeTab === 'settings' && (
            <div className="p-6">
              <SettingsTab projectId={params.id} project={project} />
            </div>
          )}
          {activeTab === 'howto' && (
            <div className="p-6">
              <HowToTab
                isAdmin={Boolean(isAdmin)}
                isSuperAdmin={session?.user?.systemRole === 'SUPER_ADMIN'}
                onReplayTour={() => {
                  setTourDismissed(false)
                  setForceTour(true)
                  setActiveTab('overview')
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
