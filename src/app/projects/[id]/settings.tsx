'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Save, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'

interface Project {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  embedEnabled: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    mapMarkers: number
    feedbackForms: number
  }
}

interface SettingsTabProps {
  projectId: string
  project: Project
}

export function SettingsTab({ projectId, project }: SettingsTabProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { canDeleteProject, canEdit } = usePermissions()

  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const updateProject = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Settings saved successfully')
    },
    onError: () => {
      toast.error('Failed to save settings')
    },
  })

  const deleteProject = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      router.push('/')
    },
    onError: () => {
      toast.error('Failed to delete project')
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    updateProject.mutate({
      name: name.trim(),
      description: description.trim(),
    })
  }

  const handleDelete = () => {
    if (deleteConfirmText === project.name) {
      deleteProject.mutate()
    }
  }

  const hasChanges = name !== project.name ||
    description !== (project.description || '')

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <section className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">General Settings</h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="label">
              Project Name <span className="label-required" aria-hidden="true"></span>
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="Enter project name"
              disabled={!canEdit}
              required
            />
          </div>

          <div>
            <label htmlFor="project-description" className="label">
              Description
            </label>
            <textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full min-h-[100px] resize-y"
              placeholder="Enter project description"
              disabled={!canEdit}
              rows={3}
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!hasChanges || updateProject.isPending || !name.trim()}
                className="btn-primary"
              >
                <Save size={18} aria-hidden="true" />
                {updateProject.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Project Info */}
      <section className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Project Information</h3>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Project ID</dt>
            <dd className="text-slate-900 font-mono">{project.id}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-900">
              {new Date(project.createdAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Last Updated</dt>
            <dd className="text-slate-900">
              {new Date(project.updatedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Map Embed</dt>
            <dd className="text-slate-900">
              {project.embedEnabled ? (
                <span className="badge-green">Enabled</span>
              ) : (
                <span className="badge-gray">Disabled</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Danger Zone */}
      {canDeleteProject && (
        <section className="card p-6 border-red-200 bg-red-50">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-red-700 mb-4">
            Once you delete a project, there is no going back. This will permanently delete the project
            and all associated data including map markers, forms, and feedback.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-danger"
            >
              <Trash2 size={18} aria-hidden="true" />
              Delete Project
            </button>
          ) : (
            <div className="bg-white border border-red-200 rounded-lg p-4 space-y-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-red-900">Are you absolutely sure?</p>
                  <p className="text-sm text-red-700 mt-1">
                    This action cannot be undone. Please type <strong>{project.name}</strong> to confirm.
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="input w-full"
                placeholder="Type project name to confirm"
                aria-label="Type project name to confirm deletion"
              />

              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirmText !== project.name || deleteProject.isPending}
                  className="btn-danger"
                >
                  <Trash2 size={18} aria-hidden="true" />
                  {deleteProject.isPending ? 'Deleting...' : 'Delete Project'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
