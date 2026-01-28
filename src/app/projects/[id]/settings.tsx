'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Save, Trash2, AlertTriangle, Mail, Info, Reply, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, ExternalLink, Check, Copy, Globe } from 'lucide-react'
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
  autoReplyEnabled: boolean
  autoReplySubject: string | null
  autoReplyMessage: string | null
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
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(project.autoReplyEnabled || false)
  const [autoReplySubject, setAutoReplySubject] = useState(project.autoReplySubject || 'Thank you for your enquiry')
  const [autoReplyMessage, setAutoReplyMessage] = useState(project.autoReplyMessage || `Dear {{name}},

Thank you for contacting us about {{subject}}.

We have received your enquiry and a member of our team will respond as soon as possible.

Kind regards,
The {{project}} Team`)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [showDomainWizard, setShowDomainWizard] = useState(false)
  const [copiedRecord, setCopiedRecord] = useState<string | null>(null)

  const copyToClipboard = (text: string, recordType: string) => {
    navigator.clipboard.writeText(text)
    setCopiedRecord(recordType)
    setTimeout(() => setCopiedRecord(null), 2000)
  }

  const updateProject = useMutation({
    mutationFn: (data: {
      name: string
      description: string
      emailFromName?: string
      emailFromAddress?: string
      autoReplyEnabled?: boolean
      autoReplySubject?: string
      autoReplyMessage?: string
    }) =>
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
      autoReplyEnabled,
      autoReplySubject: autoReplySubject.trim() || undefined,
      autoReplyMessage: autoReplyMessage.trim() || undefined,
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
    emailFromAddress !== (project.emailFromAddress || '') ||
    autoReplyEnabled !== (project.autoReplyEnabled || false) ||
    autoReplySubject !== (project.autoReplySubject || 'Thank you for your enquiry') ||
    autoReplyMessage !== (project.autoReplyMessage || '')

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

        {/* Domain Setup Wizard Toggle */}
        <button
          type="button"
          onClick={() => setShowDomainWizard(!showDomainWizard)}
          className="w-full bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-4 mb-6 flex items-center justify-between hover:from-violet-100 hover:to-blue-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Globe size={24} className="text-violet-600" />
            <div className="text-left">
              <p className="font-medium text-slate-900">Domain Setup Wizard</p>
              <p className="text-sm text-slate-600">Step-by-step guide to configure your custom email domain</p>
            </div>
          </div>
          {showDomainWizard ? (
            <ChevronUp size={20} className="text-slate-500" />
          ) : (
            <ChevronDown size={20} className="text-slate-500" />
          )}
        </button>

        {/* Domain Setup Wizard Content */}
        {showDomainWizard && (
          <div className="bg-slate-50 rounded-lg p-6 mb-6 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Add your domain to Resend</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Go to Resend and add your project domain (e.g., yourproject.com)
                </p>
                <a
                  href="https://resend.com/domains/add"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
                >
                  Open Resend Domains <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Add DNS records for sending (Resend provides these)</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Copy the DNS records from Resend and add them to your domain registrar (e.g., Hostinger, GoDaddy, Cloudflare).
                  These typically include SPF, DKIM, and DMARC records.
                </p>
                <div className="bg-white rounded border border-slate-200 p-3 text-xs font-mono text-slate-700">
                  <p className="mb-1"><span className="text-violet-600">TXT</span> - SPF record (email sending authorization)</p>
                  <p className="mb-1"><span className="text-violet-600">TXT</span> - DKIM record (email authentication)</p>
                  <p><span className="text-violet-600">TXT</span> - DMARC record (email policy)</p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Add MX record for receiving (inbound emails)</h4>
                <p className="text-sm text-slate-600 mb-3">
                  To receive emails at your domain, add this MX record. This allows people to email your project directly.
                </p>
                <div className="bg-white rounded border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Type: MX | Priority: 4</p>
                      <p className="text-sm font-mono text-slate-800">inbound-smtp.eu-west-1.amazonaws.com</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('inbound-smtp.eu-west-1.amazonaws.com', 'mx')}
                      className="p-2 hover:bg-slate-100 rounded"
                      title="Copy to clipboard"
                    >
                      {copiedRecord === 'mx' ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-amber-600 mt-2">
                  Important: Delete any existing MX records before adding this one to avoid conflicts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">4</div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Configure webhook in Resend</h4>
                <p className="text-sm text-slate-600 mb-3">
                  Set up a webhook in Resend to forward incoming emails to Placemaker.
                </p>
                <div className="bg-white rounded border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Webhook URL:</p>
                      <p className="text-sm font-mono text-slate-800">https://www.placemakerai.io/api/webhooks/email</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://www.placemakerai.io/api/webhooks/email', 'webhook')}
                      className="p-2 hover:bg-slate-100 rounded"
                      title="Copy to clipboard"
                    >
                      {copiedRecord === 'webhook' ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} className="text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
                <a
                  href="https://resend.com/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium mt-2"
                >
                  Configure Webhooks in Resend <ExternalLink size={14} />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                <Check size={16} />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-900 mb-2">Enter your email address below</h4>
                <p className="text-sm text-slate-600">
                  Once your domain is verified in Resend, enter your sender email address below (e.g., info@yourproject.com).
                  Emails sent to this address will appear in your Enquiries inbox.
                </p>
              </div>
            </div>
          </div>
        )}

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
              placeholder="e.g., info@yourproject.com"
              disabled={!canEdit}
            />
            <p className="text-xs text-slate-500 mt-1">
              Must be from a verified domain in Resend. Emails sent to this address will appear in your inbox.
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

      {/* Auto-Reply Settings */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Reply size={20} className="text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">Auto-Reply Settings</h3>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Automatic acknowledgement emails</p>
              <p>When enabled, an automatic reply will be sent to anyone who emails your project inbox.</p>
              <p className="mt-2">Available placeholders: <code className="bg-amber-100 px-1 rounded">{"{{name}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{subject}}"}</code> <code className="bg-amber-100 px-1 rounded">{"{{project}}"}</code></p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="label mb-0">Enable Auto-Reply</label>
              <p className="text-xs text-slate-500">Send automatic acknowledgement when emails are received</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
              disabled={!canEdit || !emailFromAddress}
              className={`relative flex items-center ${!canEdit || !emailFromAddress ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-label={autoReplyEnabled ? 'Disable auto-reply' : 'Enable auto-reply'}
            >
              {autoReplyEnabled ? (
                <ToggleRight size={40} className="text-violet-600" />
              ) : (
                <ToggleLeft size={40} className="text-slate-400" />
              )}
            </button>
          </div>

          {!emailFromAddress && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              Configure your email sender address above to enable auto-replies.
            </p>
          )}

          {autoReplyEnabled && emailFromAddress && (
            <>
              <div>
                <label htmlFor="auto-reply-subject" className="label">
                  Auto-Reply Subject
                </label>
                <input
                  id="auto-reply-subject"
                  type="text"
                  value={autoReplySubject}
                  onChange={(e) => setAutoReplySubject(e.target.value)}
                  className="input w-full"
                  placeholder="e.g., Thank you for your enquiry"
                  disabled={!canEdit}
                />
              </div>

              <div>
                <label htmlFor="auto-reply-message" className="label">
                  Auto-Reply Message
                </label>
                <textarea
                  id="auto-reply-message"
                  value={autoReplyMessage}
                  onChange={(e) => setAutoReplyMessage(e.target.value)}
                  className="input w-full min-h-[180px] resize-y font-mono text-sm"
                  placeholder="Enter the auto-reply message..."
                  disabled={!canEdit}
                  rows={8}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use {"{{name}}"} for sender name, {"{{subject}}"} for email subject, {"{{project}}"} for project name
                </p>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-500 mb-2 font-medium">Preview:</p>
                <div className="text-sm text-slate-700 whitespace-pre-wrap">
                  {autoReplyMessage
                    .replace(/\{\{name\}\}/gi, 'John Smith')
                    .replace(/\{\{subject\}\}/gi, 'Question about the project')
                    .replace(/\{\{project\}\}/gi, project.name)}
                </div>
              </div>
            </>
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
                {updateProject.isPending ? 'Saving...' : 'Save Auto-Reply Settings'}
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
