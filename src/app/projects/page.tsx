'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, MapPin, Users, FileText, Trash2, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ProjectOnboardingWizard from '@/components/ProjectOnboardingWizard'
import { Sidebar } from '@/components/Sidebar'
import { usePermissions } from '@/hooks/usePermissions'

interface Project {
  id: string
  name: string
  description: string | null
  _count: {
    stakeholders: number
    feedbackForms: number
    mapMarkers: number
  }
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
      <main id="main-content" className="flex-1 p-8 bg-slate-50">
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
                  ? 'Get started by creating your first consultation project to track stakeholders and collect feedback.'
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
              {projects?.map(project => (
                <article
                  key={project.id}
                  className="card-hover p-6 group"
                  role="listitem"
                >
                  <div className="flex justify-between items-start mb-3">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-lg font-semibold text-slate-900 hover:text-brand-600 focus:text-brand-600 transition-colors"
                    >
                      {project.name}
                    </Link>

                    {canDeleteProject && (
                      deleteConfirm === project.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteProject.mutate(project.id)}
                            className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            aria-label={`Confirm delete ${project.name}`}
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                            aria-label="Cancel delete"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(project.id)}
                          className="btn-icon opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          aria-label={`Delete ${project.name}`}
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </button>
                      )
                    )}
                  </div>

                  {project.description && (
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5" title="Stakeholders">
                      <Users size={16} aria-hidden="true" />
                      <span>{project._count.stakeholders}</span>
                      <span className="sr-only">stakeholders</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="Map markers">
                      <MapPin size={16} aria-hidden="true" />
                      <span>{project._count.mapMarkers}</span>
                      <span className="sr-only">map markers</span>
                    </span>
                    <span className="flex items-center gap-1.5" title="Feedback forms">
                      <FileText size={16} aria-hidden="true" />
                      <span>{project._count.feedbackForms}</span>
                      <span className="sr-only">feedback forms</span>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
      </main>
    </div>
  )
}
