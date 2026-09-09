'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { toast } from 'sonner'
import {
  Mail, Plus, Trash2, Send, Download, Pencil, X, Users,
} from 'lucide-react'

interface Subscriber {
  id: string
  email: string
  name: string | null
  source: string
  subscribed: boolean
  unsubscribedAt: string | null
  createdAt: string
}

interface Campaign {
  id: string
  subject: string
  body: string
  status: 'draft' | 'sent' | 'failed'
  sentAt: string | null
  sentBy: string | null
  recipientCount: number
  failedCount: number
  createdAt: string
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Added manually',
  enquiry: 'Enquiry form',
  feedback_form: 'Feedback form',
  subscribe_embed: 'Signup form',
}

const STATUS_META: Record<Campaign['status'], { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-amber-100 text-amber-700' },
  sent: { label: 'Sent', className: 'bg-green-100 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-700' },
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MailingListTab({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [addingSubscriber, setAddingSubscriber] = useState(false)
  const [composing, setComposing] = useState<null | { campaign?: Campaign }>(null)
  const [confirmSend, setConfirmSend] = useState<Campaign | null>(null)

  const subscribersKey = ['subscribers', projectId]
  const campaignsKey = ['campaigns', projectId]

  const { data: subscribers = [], isLoading: loadingSubscribers, error: subscribersError } = useQuery<Subscriber[]>({
    queryKey: subscribersKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/subscribers`),
  })

  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery<Campaign[]>({
    queryKey: campaignsKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/campaigns`),
  })

  const deleteSubscriber = useMutation({
    mutationFn: (subscriberId: string) =>
      fetchJson(`/api/projects/${projectId}/subscribers?subscriberId=${subscriberId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscribersKey })
      toast.success('Subscriber removed')
    },
    onError: (e: Error) => toast.error(e.message || 'Could not remove subscriber'),
  })

  const deleteCampaign = useMutation({
    mutationFn: (campaignId: string) =>
      fetchJson(`/api/projects/${projectId}/campaigns/${campaignId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignsKey })
      toast.success('Draft deleted')
    },
    onError: (e: Error) => toast.error(e.message || 'Could not delete draft'),
  })

  const sendCampaign = useMutation({
    mutationFn: (campaignId: string) =>
      fetchJson<{ sent: number; failed: number }>(`/api/projects/${projectId}/campaigns/${campaignId}/send`, { method: 'POST' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: campaignsKey })
      setConfirmSend(null)
      toast.success(`Sent to ${result.sent} subscriber${result.sent === 1 ? '' : 's'}${result.failed ? ` (${result.failed} failed)` : ''}`)
    },
    onError: (e: Error) => {
      queryClient.invalidateQueries({ queryKey: campaignsKey })
      setConfirmSend(null)
      toast.error(e.message || 'Send failed')
    },
  })

  const subscribedCount = subscribers.filter(s => s.subscribed).length

  if (loadingSubscribers || loadingCampaigns) {
    return <div className="flex justify-center py-16"><Spinner /></div>
  }
  if (subscribersError) {
    return <div className="card p-6 text-center text-slate-600">Couldn’t load the mailing list. {(subscribersError as Error).message}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <Mail size={20} className="text-green-600" aria-hidden="true" />
          Mailing list
        </h2>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {subscribers.length > 0 && (
              <a href={`/api/projects/${projectId}/subscribers/export`} className="btn-secondary flex items-center gap-2">
                <Download size={16} aria-hidden="true" /> Export CSV
              </a>
            )}
            <button onClick={() => setAddingSubscriber(true)} className="btn-secondary flex items-center gap-2">
              <Plus size={16} aria-hidden="true" /> Add subscriber
            </button>
            <button
              onClick={() => setComposing({})}
              className="btn-primary flex items-center gap-2"
            >
              <Send size={16} aria-hidden="true" /> New email
            </button>
          </div>
        )}
      </div>

      {/* Campaigns */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900 mb-4">Emails</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No emails yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {campaigns.map(campaign => {
              const meta = STATUS_META[campaign.status] ?? STATUS_META.draft
              return (
                <li key={campaign.id} className="py-3 flex items-center gap-3">
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.className}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{campaign.subject}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {campaign.status === 'sent'
                        ? `Sent ${campaign.sentAt ? fmtDate(campaign.sentAt) : ''} to ${campaign.recipientCount} subscriber${campaign.recipientCount === 1 ? '' : 's'}${campaign.failedCount ? ` · ${campaign.failedCount} failed` : ''}${campaign.sentBy ? ` · ${campaign.sentBy}` : ''}`
                        : `Created ${fmtDate(campaign.createdAt)}`}
                    </p>
                  </div>
                  {isAdmin && campaign.status !== 'sent' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setComposing({ campaign })}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                        aria-label="Edit draft"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setConfirmSend(campaign)}
                        className="p-2 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50"
                        aria-label="Send"
                      >
                        <Send size={15} />
                      </button>
                      <button
                        onClick={() => deleteCampaign.mutate(campaign.id)}
                        className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        aria-label="Delete draft"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Subscribers */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Users size={18} className="text-green-600" aria-hidden="true" />
            Subscribers
          </h3>
          <span className="text-xs text-slate-400">
            {subscribedCount} subscribed{subscribers.length > subscribedCount ? ` · ${subscribers.length - subscribedCount} unsubscribed` : ''}
          </span>
        </div>
        {subscribers.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No subscribers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Added</th>
                  {isAdmin && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscribers.map(subscriber => (
                  <tr key={subscriber.id}>
                    <td className="py-2.5 pr-3 text-slate-900">{subscriber.email}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{subscriber.name || '—'}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{SOURCE_LABELS[subscriber.source] ?? subscriber.source}</td>
                    <td className="py-2.5 pr-3">
                      {subscriber.subscribed ? (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Subscribed</span>
                      ) : (
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">Unsubscribed</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{fmtDate(subscriber.createdAt)}</td>
                    {isAdmin && (
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => deleteSubscriber.mutate(subscriber.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                          aria-label={`Remove ${subscriber.email}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addingSubscriber && (
        <AddSubscriberModal
          projectId={projectId}
          onClose={() => setAddingSubscriber(false)}
          onAdded={() => {
            setAddingSubscriber(false)
            queryClient.invalidateQueries({ queryKey: subscribersKey })
          }}
        />
      )}

      {composing && (
        <ComposeModal
          projectId={projectId}
          campaign={composing.campaign}
          onClose={() => setComposing(null)}
          onSaved={() => {
            setComposing(null)
            queryClient.invalidateQueries({ queryKey: campaignsKey })
          }}
        />
      )}

      {confirmSend && (
        <ConfirmSendModal
          campaign={confirmSend}
          recipientCount={subscribedCount}
          sending={sendCampaign.isPending}
          onCancel={() => setConfirmSend(null)}
          onConfirm={() => sendCampaign.mutate(confirmSend.id)}
        />
      )}
    </div>
  )
}

// ---- modals -----------------------------------------------------------------

function ModalShell({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={label} className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function AddSubscriberModal({
  projectId, onClose, onAdded,
}: {
  projectId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const add = useMutation({
    mutationFn: () =>
      fetchJson(`/api/projects/${projectId}/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined }),
      }),
    onSuccess: () => { toast.success('Subscriber added'); onAdded() },
    onError: (e: Error) => toast.error(e.message || 'Could not add subscriber'),
  })

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <ModalShell onClose={onClose} label="Add subscriber">
      <form onSubmit={e => { e.preventDefault(); if (valid) add.mutate() }} className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Add subscriber</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="jane@example.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input" />
        </div>
        <p className="text-xs text-slate-400">
          Only add people who have agreed to receive project updates.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!valid || add.isPending} className="btn-primary">
            {add.isPending ? <Spinner size="sm" /> : 'Add subscriber'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ComposeModal({
  projectId, campaign, onClose, onSaved,
}: {
  projectId: string
  campaign?: Campaign
  onClose: () => void
  onSaved: () => void
}) {
  const [subject, setSubject] = useState(campaign?.subject ?? '')
  const [body, setBody] = useState(campaign?.body ?? '')

  const save = useMutation({
    mutationFn: () =>
      campaign
        ? fetchJson(`/api/projects/${projectId}/campaigns/${campaign.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, body }),
          })
        : fetchJson(`/api/projects/${projectId}/campaigns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, body }),
          }),
    onSuccess: () => { toast.success(campaign ? 'Draft updated' : 'Draft saved'); onSaved() },
    onError: (e: Error) => toast.error(e.message || 'Could not save draft'),
  })

  const valid = subject.trim().length > 0 && body.trim().length > 0

  return (
    <ModalShell onClose={onClose} label={campaign ? 'Edit draft' : 'New email'}>
      <form onSubmit={e => { e.preventDefault(); if (valid) save.mutate() }} className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{campaign ? 'Edit draft' : 'New email'}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input autoFocus value={subject} onChange={e => setSubject(e.target.value)} className="input" maxLength={200} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            className="input min-h-[200px]"
            maxLength={20000}
            placeholder={'Hi {{name}},\n\n…'}
          />
          <p className="text-xs text-slate-400 mt-1">
            {'{{name}}'} and {'{{project}}'} are replaced per recipient. An unsubscribe link is added automatically.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!valid || save.isPending} className="btn-primary">
            {save.isPending ? <Spinner size="sm" /> : 'Save draft'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function ConfirmSendModal({
  campaign, recipientCount, sending, onCancel, onConfirm,
}: {
  campaign: Campaign
  recipientCount: number
  sending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <ModalShell onClose={onCancel} label="Send email">
      <div className="p-5 space-y-4">
        <h3 className="font-semibold text-slate-900">Send “{campaign.subject}”?</h3>
        <p className="text-sm text-slate-600">
          This will email {recipientCount} subscriber{recipientCount === 1 ? '' : 's'}. Sent emails can’t be edited or recalled.
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary" disabled={sending}>Cancel</button>
          <button onClick={onConfirm} disabled={sending || recipientCount === 0} className="btn-primary flex items-center gap-2">
            {sending ? <Spinner size="sm" /> : <><Send size={16} aria-hidden="true" /> Send now</>}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
