'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FolderOpen, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ProjectOnboardingWizard from '@/components/ProjectOnboardingWizard'
import { Sidebar } from '@/components/Sidebar'
import InteractiveDots from '@/components/testpage/InteractiveDots'
import { usePermissions } from '@/hooks/usePermissions'

interface Project {
  id: string
  name: string
  description: string | null
  status: 'LIVE' | 'CLOSED' | 'ARCHIVED'
  latitude: number | null
  longitude: number | null
  embedEnabled: boolean
  stats: {
    mapComments: number
    forms: number
    responses: number
    enquiries: number
  }
  pendingPins: number
  lastActivity: string | null
}

/** Compact relative time for the card activity line. */
function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const STATUS_STYLES: Record<Project['status'], { label: string; dot: string; text: string }> = {
  LIVE: { label: 'Live', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  CLOSED: { label: 'Closed', dot: 'bg-amber-500', text: 'text-amber-700' },
  ARCHIVED: { label: 'Archived', dot: 'bg-slate-400', text: 'text-slate-500' },
}

export default function ProjectsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const { canCreateProject, canDeleteProject, isLoading: authLoading } = usePermissions()

  const { data: projects, isLoading, isError, error } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const r = await fetch('/api/projects')
      if (!r.ok) {
        if (r.status === 401) {
          throw new Error('Please sign in to view projects')
        }
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${r.status}`)
      }
      return r.json()
    },
  })

  const deleteProject = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteConfirm(null)
    },
  })

  const handleProjectCreated = (projectId: string) => {
    queryClient.invalidateQueries({ queryKey: ['projects'] })
    setShowWizard(false)
    router.push(`/projects/${projectId}`)
  }

  return (
    <div className="flex min-h-screen">
      {/* Skip link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <main id="main-content" className="flex-1 p-8 bg-[#F7F6F4] relative overflow-hidden">
        {/* Same interactive dot background as the homepage and login */}
        <InteractiveDots background="#F7F6F4" />
        <div className="relative z-10">
          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Projects</h2>
              <p className="text-slate-600 mt-1">Manage your consultation projects</p>
            </div>
            {canCreateProject && (
              <button
                onClick={() => setShowWizard(true)}
                className="btn-primary"
                aria-haspopup="dialog"
              >
                <Plus size={18} aria-hidden="true" />
                New Project
              </button>
            )}
          </div>

          {/* Project Onboarding Wizard */}
          <ProjectOnboardingWizard
            isOpen={showWizard}
            onClose={() => setShowWizard(false)}
            onComplete={handleProjectCreated}
          />

          {/* Loading state */}
          {isLoading || authLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-6">
                  <div className="skeleton h-6 w-3/4 mb-3" />
                  <div className="skeleton h-4 w-full mb-4" />
                  <div className="flex gap-4">
                    <div className="skeleton h-4 w-16" />
                    <div className="skeleton h-4 w-16" />
                    <div className="skeleton h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : isError ? (
            /* Error state */
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">!</span>
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">Failed to load projects</h3>
              <p className="text-slate-600 mb-4 max-w-sm mx-auto">
                {error instanceof Error ? error.message : 'An error occurred while loading projects.'}
              </p>
              <button
                onClick={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
                className="btn-secondary"
              >
                Try Again
              </button>
            </div>
          ) : projects?.length === 0 ? (
            /* Empty state */
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-cream-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-slate-400" aria-hidden="true" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No projects yet</h3>
              <p className="text-slate-600 mb-6 max-w-sm mx-auto">
                {canCreateProject
                  ? 'Get started by creating your first consultation project to collect map feedback, build feedback forms, and analyse responses with AI.'
                  : 'You don\'t have access to any projects yet. Contact an admin to get access.'}
              </p>
              {canCreateProject && (
                <button
                  onClick={() => setShowWizard(true)}
                  className="btn-primary"
                >
                  <Plus size={18} aria-hidden="true" />
                  Create First Project
                </button>
              )}
            </div>
          ) : (
            /* Project grid */
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" role="list">
              {projects?.map(project => (
                <article
                  key={project.id}
                  className="group relative bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden flex flex-col"
                  role="listitem"
                >
                  {/* Brand gradient banner (map thumbnail parked until real
                      project locations are set) */}
                  <Link href={`/projects/${project.id}`} className="block relative">
                    <div
                      className="w-full h-28"
                      style={{
                        background:
                          'radial-gradient(120% 140% at 15% 10%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 45%), linear-gradient(135deg, #ECFDF5 0%, #A7F3D0 55%, #4ADE80 100%)',
                      }}
                    />
                    {/* Status pill — consultation lifecycle */}
                    <span
                      className={`absolute top-3 left-3 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm bg-white ${STATUS_STYLES[project.status].text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[project.status].dot}`} />
                      {STATUS_STYLES[project.status].label}
                    </span>

                    {canDeleteProject && (
                      deleteConfirm === project.id ? (
                        <div className="absolute top-3 right-3 flex items-center gap-1" onClick={(e) => e.preventDefault()}>
                          <button
                            onClick={() => deleteProject.mutate(project.id)}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors shadow-sm"
                            aria-label={`Confirm delete ${project.name}`}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 bg-white text-slate-700 rounded hover:bg-slate-100 transition-colors shadow-sm"
                            aria-label="Cancel delete"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.preventDefault(); setDeleteConfirm(project.id) }}
                          className="absolute top-3 right-3 p-1.5 bg-white/90 text-slate-500 hover:text-red-600 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          aria-label={`Delete ${project.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )
                    )}
                  </Link>

                  <div className="p-5 flex-1 flex flex-col">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-brand-600 focus:text-brand-600 transition-colors"
                    >
                      {project.name}
                    </Link>

                    {project.description && (
                      <p className="text-slate-500 text-sm mt-1 mb-4 line-clamp-2">
                        {project.description}
                      </p>
                    )}

                    {/* Stat row — brag about the engagement */}
                    <div className="grid grid-cols-4 gap-2 mt-auto pt-4 border-t border-slate-100">
                      {[
                        { value: project.stats.mapComments, label: 'Map' },
                        { value: project.stats.responses, label: 'Responses' },
                        { value: project.stats.forms, label: 'Forms' },
                        { value: project.stats.enquiries, label: 'Enquiries' },
                      ].map((stat) => (
                        <div key={stat.label}>
                          <p className="text-xl font-semibold text-slate-900 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {stat.value}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Footer: moderation nudge + last activity */}
                    <div className="flex items-center justify-between mt-4 text-xs">
                      {project.pendingPins > 0 ? (
                        <Link
                          href={`/projects/${project.id}`}
                          className="inline-flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-full transition-colors"
                        >
                          <AlertTriangle size={12} />
                          {project.pendingPins} pending to review
                        </Link>
                      ) : (
                        <span className="text-slate-400">Up to date</span>
                      )}
                      {project.lastActivity && (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Clock size={12} />
                          {relativeTime(project.lastActivity)}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
