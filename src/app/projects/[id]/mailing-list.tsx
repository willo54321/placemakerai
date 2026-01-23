'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Mail,
  Plus,
  Trash2,
  Send,
  Users,
  FileText,
  MessageSquare,
  MapPin,
  X,
  Clock,
  CheckCircle,
} from 'lucide-react'

interface Subscriber {
  id: string
  email: string
  name: string | null
  source: string
  subscribed: boolean
  createdAt: string
}

interface ProjectEmail {
  id: string
  subject: string
  body: string
  sentBy: string
  sentAt: string
  recipientCount: number
}

interface MailingListTabProps {
  projectId: string
}

const sourceLabels: Record<string, { label: string; icon: typeof Mail }> = {
  manual: { label: 'Added Manually', icon: Plus },
  feedback_form: { label: 'Feedback Form', icon: FileText },
  enquiry: { label: 'Enquiry', icon: MessageSquare },
  public_pin: { label: 'Map Comment', icon: MapPin },
}

export function MailingListTab({ projectId }: MailingListTabProps) {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  const { data: subscribers = [], isLoading: loadingSubscribers } = useQuery<Subscriber[]>({
    queryKey: ['subscribers', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/subscribers`).then(r => r.json()),
  })

  const { data: sentEmails = [], isLoading: loadingEmails } = useQuery<ProjectEmail[]>({
    queryKey: ['projectEmails', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/emails`).then(r => r.json()),
  })

  const addSubscriber = useMutation({
    mutationFn: (data: { email: string; name?: string }) =>
      fetch(`/api/projects/${projectId}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, source: 'manual' }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers', projectId] })
      setShowAddModal(false)
      setNewEmail('')
      setNewName('')
    },
  })

  const removeSubscriber = useMutation({
    mutationFn: (subscriberId: string) =>
      fetch(`/api/projects/${projectId}/subscribers?subscriberId=${subscriberId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscribers', projectId] })
    },
  })

  const sendEmail = useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      fetch(`/api/projects/${projectId}/emails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sentBy: 'Admin' }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectEmails', projectId] })
      setShowComposeModal(false)
      setEmailSubject('')
      setEmailBody('')
    },
  })

  const activeSubscribers = subscribers.filter(s => s.subscribed)

  const handleAddSubscriber = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail.trim()) return
    addSubscriber.mutate({ email: newEmail.trim(), name: newName.trim() || undefined })
  }

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailSubject.trim() || !emailBody.trim()) return
    sendEmail.mutate({ subject: emailSubject.trim(), body: emailBody.trim() })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Mailing List</h2>
          <p className="text-slate-600 text-sm mt-1">
            {activeSubscribers.length} subscriber{activeSubscribers.length !== 1 ? 's' : ''} from consultation feedback
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddModal(true)} className="btn-secondary">
            <Plus size={18} />
            Add Subscriber
          </button>
          <button
            onClick={() => setShowComposeModal(true)}
            disabled={activeSubscribers.length === 0}
            className="btn-primary"
          >
            <Send size={18} />
            Send Email
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{activeSubscribers.length}</p>
              <p className="text-sm text-slate-500">Total Subscribers</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {subscribers.filter(s => s.source === 'feedback_form').length}
              </p>
              <p className="text-sm text-slate-500">From Forms</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                {subscribers.filter(s => s.source === 'enquiry').length}
              </p>
              <p className="text-sm text-slate-500">From Enquiries</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{sentEmails.length}</p>
              <p className="text-sm text-slate-500">Emails Sent</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Subscribers</h3>
        </div>

        {loadingSubscribers ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-12 rounded" />
            ))}
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600">No subscribers yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Subscribers are automatically added when people submit feedback or enquiries
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Email</th>
                  <th className="table-cell">Name</th>
                  <th className="table-cell">Source</th>
                  <th className="table-cell">Added</th>
                  <th className="table-cell">Status</th>
                  <th className="table-cell"></th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map(sub => {
                  const source = sourceLabels[sub.source] || sourceLabels.manual
                  const SourceIcon = source.icon
                  return (
                    <tr key={sub.id} className="table-row">
                      <td className="table-cell font-medium">{sub.email}</td>
                      <td className="table-cell text-slate-600">{sub.name || '—'}</td>
                      <td className="table-cell">
                        <span className="flex items-center gap-1.5 text-sm text-slate-600">
                          <SourceIcon size={14} />
                          {source.label}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500">
                        {new Date(sub.createdAt).toLocaleDateString()}
                      </td>
                      <td className="table-cell">
                        {sub.subscribed ? (
                          <span className="badge-green">Subscribed</span>
                        ) : (
                          <span className="badge-gray">Unsubscribed</span>
                        )}
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => removeSubscriber.mutate(sub.id)}
                          className="text-slate-400 hover:text-red-600"
                          title="Remove subscriber"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sent Emails */}
      <div className="card">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Email History</h3>
        </div>

        {loadingEmails ? (
          <div className="p-6 space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : sentEmails.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Mail className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-slate-600">No emails sent yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sentEmails.map(email => (
              <div key={email.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-slate-900">{email.subject}</h4>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{email.body}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(email.sentAt).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {email.recipientCount} recipients
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-500" />
                        Sent by {email.sentBy}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Subscriber Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add Subscriber</h3>
                <button onClick={() => setShowAddModal(false)} className="btn-icon">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddSubscriber} className="space-y-4">
                <div>
                  <label className="label">Email *</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="input"
                    placeholder="email@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    className="input"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={addSubscriber.isPending} className="btn-primary">
                    {addSubscriber.isPending ? 'Adding...' : 'Add Subscriber'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Compose Email Modal */}
      {showComposeModal && (
        <div className="modal-overlay" onClick={() => setShowComposeModal(false)}>
          <div className="modal">
            <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Send Email to Subscribers</h3>
                <button onClick={() => setShowComposeModal(false)} className="btn-icon">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-brand-700">
                  This email will be sent to <strong>{activeSubscribers.length}</strong> subscriber{activeSubscribers.length !== 1 ? 's' : ''}.
                </p>
              </div>

              <form onSubmit={handleSendEmail} className="space-y-4">
                <div>
                  <label className="label">Subject *</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    className="input"
                    placeholder="Project update..."
                    required
                  />
                </div>
                <div>
                  <label className="label">Message *</label>
                  <textarea
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    className="input min-h-[200px]"
                    placeholder="Write your message here..."
                    required
                  />
                </div>
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setShowComposeModal(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={sendEmail.isPending} className="btn-primary">
                    <Send size={18} />
                    {sendEmail.isPending ? 'Sending...' : 'Send Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
