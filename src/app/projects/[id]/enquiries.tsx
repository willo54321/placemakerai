'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, X, Search, Filter, Send, MessageSquare,
  Clock, CheckCircle, AlertCircle, User, Mail, Phone, Building,
  ChevronRight, UserPlus, Trash2, Edit2
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string | null
}

interface Enquiry {
  id: string
  submitterName: string
  submitterEmail: string
  submitterPhone: string | null
  submitterOrg: string | null
  subject: string
  message: string
  category: string
  priority: string
  status: string
  draftResponse: string | null
  assignedTo: TeamMember | null
  createdAt: string
}

interface EnquiryMessage {
  id: string
  type: string
  content: string
  authorName: string
  createdAt: string
}

interface EnquiryQuery {
  id: string
  teamMember: TeamMember
  question: string
  response: string | null
  status: string
  token: string
  sentAt: string
  respondedAt: string | null
}

interface EnquiryDetail extends Enquiry {
  messages: EnquiryMessage[]
  queries: EnquiryQuery[]
}

interface Project {
  id: string
  name: string
  enquiries: Enquiry[]
  teamMembers: TeamMember[]
}

const STATUSES = [
  { value: 'new', label: 'New', className: 'badge-blue', icon: AlertCircle },
  { value: 'in_progress', label: 'In Progress', className: 'badge-amber', icon: Clock },
  { value: 'awaiting_info', label: 'Awaiting Info', className: 'badge-purple', icon: MessageSquare },
  { value: 'ready_to_send', label: 'Ready to Send', className: 'badge-green', icon: CheckCircle },
  { value: 'sent', label: 'Sent', className: 'badge-gray', icon: Send },
  { value: 'closed', label: 'Closed', className: 'badge-gray', icon: CheckCircle },
]

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'planning', label: 'Planning' },
  { value: 'objection', label: 'Objection' },
  { value: 'support', label: 'Support' },
  { value: 'complaint', label: 'Complaint' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', className: 'text-slate-500' },
  { value: 'normal', label: 'Normal', className: 'text-slate-700' },
  { value: 'high', label: 'High', className: 'text-amber-600' },
  { value: 'urgent', label: 'Urgent', className: 'text-red-600' },
]

// Progress steps for workflow visualization
const WORKFLOW_STEPS = [
  { status: 'new', label: 'Received', shortLabel: 'New' },
  { status: 'in_progress', label: 'In Progress', shortLabel: 'Working' },
  { status: 'awaiting_info', label: 'Gathering Info', shortLabel: 'Info' },
  { status: 'ready_to_send', label: 'Ready for Approval', shortLabel: 'Ready' },
  { status: 'sent', label: 'Response Sent', shortLabel: 'Sent' },
]

// Progress Stepper Component
function ProgressStepper({ currentStatus, compact = false }: { currentStatus: string; compact?: boolean }) {
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.status === currentStatus)
  const isClosed = currentStatus === 'closed'

  if (compact) {
    // Compact version for list items - just dots
    return (
      <div className="flex items-center gap-1" title={WORKFLOW_STEPS[currentIndex]?.label || currentStatus}>
        {WORKFLOW_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex || isClosed
          const isCurrent = index === currentIndex && !isClosed
          return (
            <div
              key={step.status}
              className={`w-2 h-2 rounded-full transition-colors ${
                isCompleted
                  ? 'bg-green-500'
                  : isCurrent
                  ? 'bg-blue-500 ring-2 ring-blue-200'
                  : 'bg-slate-200'
              }`}
            />
          )
        })}
        {isClosed && (
          <CheckCircle size={12} className="text-green-500 ml-1" />
        )}
      </div>
    )
  }

  // Full version for detail view
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200" />
        <div
          className="absolute top-3 left-0 h-0.5 bg-green-500 transition-all duration-300"
          style={{
            width: isClosed
              ? '100%'
              : `${Math.max(0, (currentIndex / (WORKFLOW_STEPS.length - 1)) * 100)}%`
          }}
        />

        {/* Steps */}
        {WORKFLOW_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex || isClosed
          const isCurrent = index === currentIndex && !isClosed
          return (
            <div key={step.status} className="relative flex flex-col items-center z-10">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                    ? 'bg-blue-500 text-white ring-4 ring-blue-100'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle size={14} />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1.5 text-xs whitespace-nowrap ${
                  isCurrent ? 'text-blue-600 font-medium' : isCompleted ? 'text-green-600' : 'text-slate-500'
                }`}
              >
                {step.shortLabel}
              </span>
            </div>
          )
        })}
      </div>
      {isClosed && (
        <div className="text-center mt-3">
          <span className="badge-green">Completed</span>
        </div>
      )}
    </div>
  )
}

export function EnquiriesTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedEnquiry, setSelectedEnquiry] = useState<EnquiryDetail | null>(null)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showQueryModal, setShowQueryModal] = useState(false)
  const [embedCode, setEmbedCode] = useState('')

  const enquiries = project.enquiries || []
  const teamMembers = project.teamMembers || []

  // Filter enquiries
  const filteredEnquiries = enquiries.filter(e => {
    const matchesSearch =
      e.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.submitterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.submitterEmail.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = !statusFilter || e.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Count new enquiries
  const newCount = enquiries.filter(e => e.status === 'new').length

  // Load enquiry detail
  const loadEnquiryDetail = async (enquiryId: string) => {
    const res = await fetch(`/api/projects/${projectId}/enquiries/${enquiryId}`)
    const data = await res.json()
    setSelectedEnquiry(data)
  }

  // Generate embed code
  const generateEmbedCode = () => {
    const url = `${window.location.origin}/embed/${projectId}/enquiry`
    setEmbedCode(`<iframe src="${url}" width="100%" height="600" frameborder="0"></iframe>`)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Enquiries
            {newCount > 0 && (
              <span className="ml-2 badge-blue">{newCount} new</span>
            )}
          </h2>
          <p className="text-sm text-slate-600">Manage stakeholder enquiries and responses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTeamModal(true)}
            className="btn-secondary"
          >
            <UserPlus size={18} aria-hidden="true" />
            Team
          </button>
          <button
            onClick={generateEmbedCode}
            className="btn-primary"
          >
            Embed Form
          </button>
        </div>
      </div>

      {/* Embed code display */}
      {embedCode && (
        <div className="card p-4 mb-4 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Embed Code</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(embedCode)
              }}
              className="btn-secondary text-xs py-1"
            >
              Copy
            </button>
          </div>
          <code className="text-xs text-slate-600 break-all">{embedCode}</code>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search enquiries..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input pl-10"
            aria-label="Search enquiries"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" aria-hidden="true" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input w-auto"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Enquiry list */}
      {enquiries.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No enquiries yet</h3>
          <p className="text-slate-600 mb-6 max-w-sm mx-auto">
            Enquiries from your public form will appear here. Click "Embed Form" to get the code.
          </p>
        </div>
      ) : filteredEnquiries.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-slate-600">No enquiries match your search.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEnquiries.map(enquiry => {
            const status = STATUSES.find(s => s.value === enquiry.status) || STATUSES[0]
            const priority = PRIORITIES.find(p => p.value === enquiry.priority) || PRIORITIES[1]
            return (
              <button
                key={enquiry.id}
                onClick={() => loadEnquiryDetail(enquiry.id)}
                className="card w-full p-4 text-left hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={status.className}>{status.label}</span>
                        <span className={`text-xs font-medium ${priority.className}`}>
                          {priority.label}
                        </span>
                      </div>
                      <ProgressStepper currentStatus={enquiry.status} compact />
                    </div>
                    <h3 className="font-medium text-slate-900 truncate">{enquiry.subject}</h3>
                    <p className="text-sm text-slate-600 truncate">{enquiry.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User size={12} aria-hidden="true" />
                        {enquiry.submitterName}
                      </span>
                      {enquiry.assignedTo && (
                        <span>Assigned: {enquiry.assignedTo.name}</span>
                      )}
                      <span>{new Date(enquiry.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Enquiry detail modal */}
      {selectedEnquiry && (
        <EnquiryDetailModal
          enquiry={selectedEnquiry}
          teamMembers={teamMembers}
          projectId={projectId}
          onClose={() => setSelectedEnquiry(null)}
          onUpdate={() => {
            loadEnquiryDetail(selectedEnquiry.id)
            queryClient.invalidateQueries({ queryKey: ['project', projectId] })
          }}
        />
      )}

      {/* Team members modal */}
      {showTeamModal && (
        <TeamMembersModal
          teamMembers={teamMembers}
          projectId={projectId}
          onClose={() => setShowTeamModal(false)}
        />
      )}
    </div>
  )
}

// Enquiry Detail Modal
function EnquiryDetailModal({
  enquiry,
  teamMembers,
  projectId,
  onClose,
  onUpdate,
}: {
  enquiry: EnquiryDetail
  teamMembers: TeamMember[]
  projectId: string
  onClose: () => void
  onUpdate: () => void
}) {
  const [draftResponse, setDraftResponse] = useState(enquiry.draftResponse || '')
  const [internalNote, setInternalNote] = useState('')
  const [showQueryForm, setShowQueryForm] = useState(false)
  const [queryTeamMember, setQueryTeamMember] = useState('')
  const [queryQuestion, setQueryQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)

  const status = STATUSES.find(s => s.value === enquiry.status) || STATUSES[0]
  const priority = PRIORITIES.find(p => p.value === enquiry.priority) || PRIORITIES[1]

  // Update enquiry
  const updateEnquiry = async (data: Record<string, unknown>) => {
    await fetch(`/api/projects/${projectId}/enquiries/${enquiry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    onUpdate()
  }

  // Add internal note
  const addNote = async () => {
    if (!internalNote.trim()) return
    await fetch(`/api/projects/${projectId}/enquiries/${enquiry.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'internal_note',
        content: internalNote,
        authorName: 'Admin',
      }),
    })
    setInternalNote('')
    onUpdate()
  }

  // Send query to team member
  const sendQuery = async () => {
    if (!queryTeamMember || !queryQuestion.trim()) return
    await fetch(`/api/projects/${projectId}/enquiries/${enquiry.id}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teamMemberId: queryTeamMember,
        question: queryQuestion,
      }),
    })
    setShowQueryForm(false)
    setQueryTeamMember('')
    setQueryQuestion('')
    onUpdate()
  }

  // Approve and send response
  const approveAndSend = async () => {
    if (!draftResponse.trim() || isSending) return
    setIsSending(true)
    setSendError(null)
    setSendSuccess(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/enquiries/${enquiry.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: draftResponse,
          authorName: 'Admin',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSendError(data.error || 'Failed to send response')
        return
      }

      if (data.emailSent) {
        setSendSuccess('Response sent successfully!')
      } else {
        setSendSuccess('Response saved. Note: Email could not be sent (check email configuration)')
      }

      onUpdate()
    } catch (err) {
      setSendError('Network error - please try again')
    } finally {
      setIsSending(false)
    }
  }

  // Save draft
  const saveDraft = async () => {
    await updateEnquiry({ draftResponse, status: 'ready_to_send' })
  }

  // Delete enquiry
  const deleteEnquiry = async () => {
    if (!confirm('Are you sure you want to delete this enquiry?')) return
    await fetch(`/api/projects/${projectId}/enquiries/${enquiry.id}`, {
      method: 'DELETE',
    })
    onClose()
    onUpdate()
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-content p-0 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={status.className}>{status.label}</span>
                  <span className={`text-xs font-medium ${priority.className}`}>
                    {priority.label} priority
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-slate-900">{enquiry.subject}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={deleteEnquiry}
                  className="btn-icon hover:text-red-600"
                  aria-label="Delete enquiry"
                >
                  <Trash2 size={18} />
                </button>
                <button onClick={onClose} className="btn-icon" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Progress stepper */}
            <div className="mt-4 mb-4 px-4">
              <ProgressStepper currentStatus={enquiry.status} />
            </div>

            {/* Submitter info */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-600">
              <span className="flex items-center gap-1">
                <User size={14} /> {enquiry.submitterName}
              </span>
              <a href={`mailto:${enquiry.submitterEmail}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                <Mail size={14} /> {enquiry.submitterEmail}
              </a>
              {enquiry.submitterPhone && (
                <span className="flex items-center gap-1">
                  <Phone size={14} /> {enquiry.submitterPhone}
                </span>
              )}
              {enquiry.submitterOrg && (
                <span className="flex items-center gap-1">
                  <Building size={14} /> {enquiry.submitterOrg}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Original message */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Original Enquiry</h3>
              <div className="card p-4 bg-slate-50">
                <p className="whitespace-pre-wrap text-slate-700">{enquiry.message}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Received {new Date(enquiry.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Activity thread */}
            {(enquiry.messages.length > 0 || enquiry.queries.length > 0) && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Activity</h3>
                <div className="space-y-3">
                  {enquiry.messages.map(msg => (
                    <div key={msg.id} className="card p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-500 uppercase">
                          {msg.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-slate-400">
                          by {msg.authorName} - {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                  {enquiry.queries.map(q => (
                    <div key={q.id} className="card p-3 border-l-4 border-brand-400">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-purple text-xs">Query to {q.teamMember.name}</span>
                        <span className="text-xs text-slate-400">
                          {new Date(q.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 mb-1">Q: {q.question}</p>
                      {q.response ? (
                        <p className="text-sm text-slate-600">A: {q.response}</p>
                      ) : (
                        <p className="text-sm text-amber-600">Awaiting response...</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Assignment & Status */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Assignment</h3>
                <select
                  value={enquiry.assignedTo?.id || ''}
                  onChange={e => updateEnquiry({ assignedToId: e.target.value || null })}
                  className="input"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map(tm => (
                    <option key={tm.id} value={tm.id}>{tm.name}</option>
                  ))}
                </select>

                <h3 className="text-sm font-medium text-slate-700 mt-4 mb-2">Status</h3>
                <select
                  value={enquiry.status}
                  onChange={e => updateEnquiry({ status: e.target.value })}
                  className="input"
                >
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Internal note */}
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Add Internal Note</h3>
                <textarea
                  value={internalNote}
                  onChange={e => setInternalNote(e.target.value)}
                  className="input min-h-[80px] resize-y"
                  placeholder="Add a note visible only to team..."
                />
                <button
                  onClick={addNote}
                  disabled={!internalNote.trim()}
                  className="btn-secondary mt-2"
                >
                  Add Note
                </button>
              </div>
            </div>

            {/* Query team member */}
            {!showQueryForm ? (
              <button
                onClick={() => setShowQueryForm(true)}
                className="btn-secondary mt-4"
                disabled={teamMembers.length === 0}
              >
                <MessageSquare size={16} />
                Query Team Member
              </button>
            ) : (
              <div className="card p-4 mt-4 bg-brand-50">
                <h3 className="text-sm font-medium text-slate-700 mb-2">Send Query</h3>
                <select
                  value={queryTeamMember}
                  onChange={e => setQueryTeamMember(e.target.value)}
                  className="input mb-2"
                >
                  <option value="">Select team member...</option>
                  {teamMembers.map(tm => (
                    <option key={tm.id} value={tm.id}>{tm.name} ({tm.email})</option>
                  ))}
                </select>
                <textarea
                  value={queryQuestion}
                  onChange={e => setQueryQuestion(e.target.value)}
                  className="input min-h-[80px] resize-y"
                  placeholder="What information do you need?"
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={sendQuery} className="btn-primary" disabled={!queryTeamMember || !queryQuestion.trim()}>
                    Send Query
                  </button>
                  <button onClick={() => setShowQueryForm(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Draft response */}
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-700 mb-2">Draft Response</h3>
              <textarea
                value={draftResponse}
                onChange={e => setDraftResponse(e.target.value)}
                className="input min-h-[120px] resize-y"
                placeholder="Write your response to the stakeholder..."
                disabled={isSending}
              />

              {/* Error/Success messages */}
              {sendError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {sendError}
                </div>
              )}
              {sendSuccess && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  {sendSuccess}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveDraft}
                  className="btn-secondary"
                  disabled={!draftResponse.trim() || isSending}
                >
                  Save Draft
                </button>
                <button
                  onClick={approveAndSend}
                  className="btn-primary"
                  disabled={!draftResponse.trim() || enquiry.status === 'sent' || isSending}
                >
                  {isSending ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Approve & Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Team Members Modal
function TeamMembersModal({
  teamMembers,
  projectId,
  onClose,
}: {
  teamMembers: TeamMember[]
  projectId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: '' })
  const [editing, setEditing] = useState<TeamMember | null>(null)

  const createMember = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/projects/${projectId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      resetForm()
    },
  })

  const updateMember = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      fetch(`/api/projects/${projectId}/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      resetForm()
    },
  })

  const deleteMember = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const resetForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', email: '', role: '' })
  }

  const startEdit = (m: TeamMember) => {
    setEditing(m)
    setForm({ name: m.name, email: m.email, role: m.role || '' })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateMember.mutate({ id: editing.id, data: form })
    } else {
      createMember.mutate(form)
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose} aria-hidden="true" />
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-content p-6 max-w-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
            <button onClick={onClose} className="btn-icon" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          {/* Team list */}
          {teamMembers.length === 0 && !showForm ? (
            <p className="text-slate-600 text-center py-4">No team members yet.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {teamMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="font-medium text-slate-900">{m.name}</div>
                    <div className="text-sm text-slate-600">{m.email}</div>
                    {m.role && <div className="text-xs text-slate-500">{m.role}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(m)} className="btn-icon">
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteMember.mutate(m.id)}
                      className="btn-icon hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add/Edit form */}
          {showForm ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label label-required">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label label-required">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Role</label>
                <input
                  type="text"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                  className="input"
                  placeholder="e.g., Planning Officer"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">
                  {editing ? 'Update' : 'Add'} Member
                </button>
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="btn-primary w-full">
              <Plus size={18} />
              Add Team Member
            </button>
          )}
        </div>
      </div>
    </>
  )
}
