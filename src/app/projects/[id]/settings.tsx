'use client'

import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Save, Trash2, AlertTriangle, FileUp, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'

interface Project {
  id: string
  name: string
  description: string | null
  status?: 'LIVE' | 'CLOSED' | 'ARCHIVED'
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  embedEnabled: boolean
  emailLocalPart?: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    mapMarkers: number
    feedbackForms: number
  }
  _emailDomain?: string | null
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
  const [status, setStatus] = useState(project.status || 'LIVE')
  const [emailLocalPart, setEmailLocalPart] = useState(project.emailLocalPart || '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const updateProject = useMutation({
    mutationFn: (data: { name: string; description: string; status: string; emailLocalPart: string | null }) =>
      fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(async r => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json.error || 'Failed to save settings')
        return json
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Settings saved successfully')
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to save settings')
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
      status,
      emailLocalPart: emailLocalPart || null,
    })
  }

  const handleDelete = () => {
    if (deleteConfirmText === project.name) {
      deleteProject.mutate()
    }
  }

  const hasChanges = name !== project.name ||
    description !== (project.description || '') ||
    status !== (project.status || 'LIVE') ||
    emailLocalPart !== (project.emailLocalPart || '')

  const emailDomain = project._emailDomain

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

          <div>
            <label htmlFor="project-status" className="label">
              Status
            </label>
            <select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'LIVE' | 'CLOSED' | 'ARCHIVED')}
              className="input w-full"
              disabled={!canEdit}
            >
              <option value="LIVE">Live — consultation open, accepting feedback</option>
              <option value="CLOSED">Closed — consultation ended, still analysing</option>
              <option value="ARCHIVED">Archived — filed away</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Shown as the status pill on the projects list. Doesn&apos;t affect whether the embed is live —
              control that in Website settings.
            </p>
          </div>

          <div>
            <label htmlFor="project-email-local-part" className="label">
              Sending Address
            </label>
            <div className="flex items-center">
              <input
                id="project-email-local-part"
                type="text"
                value={emailLocalPart}
                onChange={(e) =>
                  setEmailLocalPart(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64)
                  )
                }
                className="input w-full rounded-r-none"
                placeholder="projectname"
                disabled={!canEdit}
              />
              <span className="input w-auto shrink-0 rounded-l-none border-l-0 bg-slate-50 text-slate-500 select-none">
                @{emailDomain || '…'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {emailLocalPart && emailDomain ? (
                <>Mailing-list emails and enquiry replies send from{' '}
                  <span className="font-medium text-slate-700">
                    {name.trim() || project.name} &lt;{emailLocalPart}@{emailDomain}&gt;
                  </span>. Replies go to the sending admin&apos;s email.</>
              ) : (
                <>Leave blank to send mailing-list emails and enquiry replies from the platform address.</>
              )}
            </p>
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

      {/* Data export */}
      <section className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Data Export</h3>
        <p className="text-sm text-slate-500 mb-4">
          Exports are recorded in the audit log.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/api/projects/${projectId}/export?format=json`}
            className="btn-secondary text-sm"
            download
          >
            Full export (JSON)
          </a>
          <a
            href={`/api/projects/${projectId}/export?format=csv`}
            className="btn-secondary text-sm"
            download
          >
            Feedback spreadsheet (CSV)
          </a>
        </div>
      </section>

      {/* Word report templates */}
      <ReportTemplatesSection projectId={projectId} />

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

const TEMPLATE_KIND_LABELS: Record<string, string> = {
  stakeholders: 'Stakeholder engagement',
  feedback: 'Feedback report',
}

// Company .docx templates for branded Word exports. The newest template of
// each kind is the one the Export Word buttons use.
function ReportTemplatesSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadKind, setUploadKind] = useState('stakeholders')

  const { data: templates } = useQuery({
    queryKey: ['report-templates', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/report-templates`).then(r => r.json()),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('kind', uploadKind)
      const res = await fetch(`/api/projects/${projectId}/report-templates`, { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Upload failed')
      return body
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates', projectId] })
      toast.success('Template uploaded and validated')
    },
    onError: (err: Error) => toast.error(err.message),
    onSettled: () => { if (fileRef.current) fileRef.current.value = '' },
  })

  const remove = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/projects/${projectId}/report-templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates', projectId] })
      toast.success('Template deleted')
    },
    onError: () => toast.error('Failed to delete template'),
  })

  return (
    <section className="card p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-1">Word Report Templates</h3>
      <p className="text-sm text-slate-500 mb-4">
        Upload your company&apos;s .docx template and exports come out in your branding. Start from a
        starter template — restyle it in Word, keep the {'{tags}'}, and upload it here.
      </p>
      <div className="flex flex-wrap gap-3 mb-4">
        <a href="/report-templates/stakeholder-engagement-starter.docx" className="btn-secondary text-sm" download>
          <FileText size={16} aria-hidden="true" /> Stakeholder starter template
        </a>
        <a href="/report-templates/feedback-report-starter.docx" className="btn-secondary text-sm" download>
          <FileText size={16} aria-hidden="true" /> Feedback starter template
        </a>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={uploadKind}
          onChange={e => setUploadKind(e.target.value)}
          className="p-2 border border-slate-300 rounded-lg text-sm"
          aria-label="Template type"
        >
          <option value="stakeholders">Stakeholder engagement</option>
          <option value="feedback">Feedback report</option>
        </select>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="btn-secondary text-sm"
        >
          <FileUp size={16} aria-hidden="true" />
          {upload.isPending ? 'Validating…' : 'Upload template (.docx)'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".docx"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f) }}
        />
      </div>
      {(templates || []).length > 0 && (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
          {(templates as Array<{ id: string; name: string; kind: string; createdAt: string }>).map((t, i, arr) => {
            const isActive = arr.findIndex(x => x.kind === t.kind) === i
            return (
              <li key={t.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {TEMPLATE_KIND_LABELS[t.kind] || t.kind} · {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {isActive && <span className="ml-2 text-green-700 font-medium">Active</span>}
                  </p>
                </div>
                <button
                  onClick={() => { if (confirm(`Delete template "${t.name}"?`)) remove.mutate(t.id) }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  aria-label={`Delete template ${t.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
