'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Save, Trash2, AlertTriangle, Mail, Info } from 'lucide-react'
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
  emailFromName: string | null
  emailFromAddress: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    stakeholders: number
    mapMarkers: number
    feedbackForms: number
    enquiries: number
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
  const [emailFromName, setEmailFromName] = useState(project.emailFromName || '')
  const [emailFromAddress, setEmailFromAddress] = useState(project.emailFromAddress || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const updateProject = useMutation({
    mutationFn: (data: { name: string; description: string; emailFromName?: string; emailFromAddress?: string }) =>
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
      emailFromName: emailFromName.trim() || undefined,
      emailFromAddress: emailFromAddress.trim() || undefined,
    })
  }

  const handleDelete = () => {
    if (deleteConfirmText === project.name) {
      deleteProject.mutate()
    }
  }

  const hasChanges = name !== project.name ||
    description !== (project.description || '') ||
    emailFromName !== (project.emailFromName || '') ||
    emailFromAddress !== (project.emailFromAddress || '')

  return (
    <div className="space-y-8">
      {/* General Settings */}
      <section className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">General Settings</h3>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="project-name" className="label">
              Project Name <span className="label-required">*</span>
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

      {/* Email Settings */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={20} className="text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Email Settings</h3>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Setting up project-specific email</p>
              <p>To send emails from your own domain (e.g., noreply@yourproject.com):</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Add your domain in <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="underline">Resend Dashboard</a></li>
                <li>Add the DNS records Resend provides (SPF, DKIM, DMARC)</li>
                <li>Wait for domain verification (usually a few minutes)</li>
                <li>Enter your sender details below</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="email-from-name" className="label">
              Sender Name
            </label>
            <input
              id="email-from-name"
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              className="input w-full"
              placeholder="e.g., Project ABC Team"
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500 mt-1">
              The name that appears in the "From" field of sent emails
            </p>
          </div>

          <div>
            <label htmlFor="email-from-address" className="label">
              Sender Email Address
            </label>
            <input
              id="email-from-address"
              type="email"
              value={emailFromAddress}
              onChange={(e) => setEmailFromAddress(e.target.value)}
              className="input w-full"
              placeholder="e.g., noreply@yourproject.com"
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500 mt-1">
              Must be from a verified domain in Resend. Leave blank to use the default.
            </p>
          </div>

          {(emailFromName || emailFromAddress) && (
            <div className="bg-slate-50 rounded-lg p-3 text-sm">
              <span className="text-slate-500">Preview: </span>
              <span className="text-slate-900 font-medium">
                {emailFromName || 'Project Team'} &lt;{emailFromAddress || 'default@example.com'}&gt;
              </span>
            </div>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasChanges || updateProject.isPending}
                className="btn-primary"
              >
                <Save size={18} aria-hidden="true" />
                {updateProject.isPending ? 'Saving...' : 'Save Email Settings'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      {canDeleteProject && (
        <section className="card p-6 border-red-200 bg-red-50">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h3>
          <p className="text-sm text-red-700 mb-4">
            Once you delete a project, there is no going back. This will permanently delete the project
            and all associated data including stakeholders, map markers, forms, and enquiries.
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
