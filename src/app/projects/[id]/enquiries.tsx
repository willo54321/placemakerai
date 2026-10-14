'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { EmbedCodePanel } from '@/components/EmbedCodePanel'
import { ModalShell } from '@/components/ModalShell'
import { CopyFields, NewEmailModal, SignatureModal, SignaturePreview } from './enquiry-compose'
import { toast } from 'sonner'
import {
  Inbox, Mail, Building2, Phone, ArrowDownLeft, ArrowUpRight,
  CheckCheck, Clock, AlertCircle, CircleDot, Send, PenLine, Plus, Users, UserPlus, X,
} from 'lucide-react'

type EnquiryStatus = 'new' | 'open' | 'closed'

interface EnquiryRow {
  id: string
  submitterName: string
  submitterEmail: string
  submitterOrg: string | null
  subject: string
  category: string
  status: EnquiryStatus
  read: boolean
  assigneeId: string | null
  channel: 'form' | 'email' | 'outbound'
  replyCount: number
  lastActivityAt: string
  createdAt: string
}

interface ThreadEntry {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  authorName: string | null
  authorEmail: string | null
  deliveryStatus: string
  attachments: unknown
  cc: string[]
  bcc: string[]
  createdAt: string
  isOriginal: boolean
}

interface ThreadResponse {
  enquiry: {
    id: string
    submitterName: string
    submitterEmail: string
    submitterPhone: string | null
    submitterOrg: string | null
    subject: string
    category: string
    status: EnquiryStatus
    read: boolean
    assigneeId: string | null
    channel: 'form' | 'email' | 'outbound'
    createdAt: string
  }
  thread: ThreadEntry[]
  contacts: ThreadContact[]
}

// A person on the thread and how they relate to the stakeholder register.
interface ThreadContact {
  address: string
  name: string | null
  stakeholder: { id: string; name: string } | null
  sameOrganisation: { organization: string; type: string } | null
}

const STATUS_META: Record<EnquiryStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-green-100 text-green-700' },
  open: { label: 'Open', className: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Closed', className: 'bg-slate-100 text-slate-500' },
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: EnquiryStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

// Delivery ticks for outbound messages, mirroring familiar messaging UIs.
function DeliveryTick({ status }: { status: string }) {
  if (status === 'delivered') return <span className="inline-flex items-center gap-1 text-slate-400" title="Delivered"><CheckCheck size={13} /></span>
  if (status === 'sent' || status === 'queued') return <span className="inline-flex items-center gap-1 text-slate-400" title="Sent"><Clock size={13} /></span>
  if (status === 'bounced' || status === 'failed') return <span className="inline-flex items-center gap-1 text-red-500" title={status}><AlertCircle size={13} /></span>
  return null
}

const STATUS_FILTERS: Array<{ id: 'all' | EnquiryStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
]

export function EnquiriesTab({
  projectId, isAdmin, embedEnabled, focusEnquiryId, onFocusHandled, onOpenStakeholder,
}: {
  projectId: string
  isAdmin: boolean
  embedEnabled: boolean
  focusEnquiryId?: string | null
  onFocusHandled?: () => void
  onOpenStakeholder?: (stakeholderId: string) => void
}) {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<'all' | EnquiryStatus>('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  // The tab mounts fresh on each visit, so a deep link just seeds the selection.
  const [selectedId, setSelectedId] = useState<string | null>(focusEnquiryId ?? null)
  useEffect(() => {
    if (focusEnquiryId) onFocusHandled?.()
  }, [focusEnquiryId, onFocusHandled])
  const [composing, setComposing] = useState(false)
  const [editingSignature, setEditingSignature] = useState(false)

  const listKey = ['enquiries', projectId]
  const { data, isLoading, error } = useQuery<{ enquiries: EnquiryRow[] }>({
    queryKey: listKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/enquiries`),
  })

  const enquiries = data?.enquiries ?? []

  const filtered = useMemo(() => {
    return enquiries.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (unreadOnly && e.read) return false
      return true
    })
  }, [enquiries, statusFilter, unreadOnly])

  const unreadCount = useMemo(() => enquiries.filter(e => !e.read).length, [enquiries])

  // Keep a valid selection as filters change (once the list has loaded, so a
  // deep-linked selection survives the first render).
  useEffect(() => {
    if (data && selectedId && !filtered.some(e => e.id === selectedId)) {
      setSelectedId(null)
    }
  }, [data, filtered, selectedId])

  const patchMutation = useMutation({
    mutationFn: (vars: { id: string; body: Record<string, unknown> }) =>
      fetchJson(`/api/projects/${projectId}/enquiries/${vars.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars.body),
      }),
    // Optimistically apply to BOTH caches: the thread view's status select
    // renders from its own ['enquiry', ...] query, so updating only the list
    // would leave the control showing the old value until a refetch.
    onMutate: (vars) => {
      queryClient.setQueryData<{ enquiries: EnquiryRow[] }>(listKey, prev =>
        prev ? { enquiries: prev.enquiries.map(e => (e.id === vars.id ? ({ ...e, ...vars.body } as EnquiryRow) : e)) } : prev
      )
      queryClient.setQueryData<ThreadResponse>(['enquiry', projectId, vars.id], prev =>
        prev ? { ...prev, enquiry: { ...prev.enquiry, ...vars.body } as ThreadResponse['enquiry'] } : prev
      )
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: listKey })
      queryClient.invalidateQueries({ queryKey: ['enquiry', projectId, vars.id] })
    },
    onError: (err: Error) => toast.error(err.message || 'Update failed'),
  })

  const markRead = (id: string, read: boolean) => {
    patchMutation.mutate({ id, body: { read } })
  }

  const selectEnquiry = (row: EnquiryRow) => {
    setSelectedId(row.id)
    if (isAdmin && !row.read) markRead(row.id, true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-slate-600">
        Couldn’t load enquiries. {(error as Error).message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Inbox size={20} className="text-green-600" aria-hidden="true" />
            Enquiries
          </h2>
          {unreadCount > 0 && (
            <p className="text-sm font-medium text-slate-700 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingSignature(true)} className="btn-secondary flex items-center gap-2">
              <PenLine size={16} aria-hidden="true" /> Signature
            </button>
            <button onClick={() => setComposing(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} aria-hidden="true" /> New email
            </button>
          </div>
        )}
      </div>

      {composing && (
        <NewEmailModal
          projectId={projectId}
          onClose={() => setComposing(false)}
          onEditSignature={() => setEditingSignature(true)}
          onSent={async (id) => {
            setComposing(false)
            setStatusFilter('all')
            setUnreadOnly(false)
            // Select only once the refreshed list contains the new thread —
            // the keep-valid-selection effect would otherwise clear it.
            await queryClient.invalidateQueries({ queryKey: listKey })
            setSelectedId(id)
          }}
        />
      )}
      {editingSignature && <SignatureModal onClose={() => setEditingSignature(false)} />}

      {isAdmin && (
        <EmbedCodePanel projectId={projectId} path="enquiry" title="Enquiry form" height={900} embedEnabled={embedEnabled} />
      )}

      {enquiries.length === 0 ? (
        <div className="card p-10 text-center">
          <Inbox size={32} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium">No enquiries yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Submissions from your enquiry embed, and emails you send, will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_1fr] gap-4">
          {/* Inbox list */}
          <div className="card overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 space-y-2">
              <div className="flex items-center gap-1" role="tablist" aria-label="Filter by status">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    role="tab"
                    aria-selected={statusFilter === f.id}
                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                      statusFilter === f.id
                        ? 'bg-green-50 text-green-700'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={unreadOnly}
                    onChange={e => setUnreadOnly(e.target.checked)}
                    className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                  />
                  Unread
                </label>
              </div>
            </div>

            <ul className="overflow-y-auto divide-y divide-slate-100 max-h-[calc(100vh-16rem)]">
              {filtered.length === 0 && (
                <li className="p-6 text-center text-sm text-slate-400">
                  No enquiries match these filters.
                </li>
              )}
              {filtered.map(row => (
                <li key={row.id}>
                  <button
                    onClick={() => selectEnquiry(row)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedId === row.id ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-sm truncate ${row.read ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>
                        {!row.read && (
                          <CircleDot size={9} className="inline mr-1.5 -mt-0.5 text-green-600" aria-label="Unread" />
                        )}
                        {row.submitterName}
                      </span>
                      <StatusBadge status={row.status} />
                    </div>
                    <p className={`text-sm truncate mt-0.5 ${row.read ? 'text-slate-500' : 'text-slate-800'}`}>
                      {row.subject}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span>{formatWhen(row.lastActivityAt)}</span>
                      {row.replyCount > 0 && (
                        <span className="inline-flex items-center gap-0.5">· {row.replyCount} repl{row.replyCount === 1 ? 'y' : 'ies'}</span>
                      )}
                      {row.channel === 'email' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Email</span>
                      )}
                      {row.channel === 'outbound' && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Sent by team</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Thread view */}
          <div className="card overflow-hidden">
            {selectedId ? (
              <ThreadView
                key={selectedId}
                projectId={projectId}
                enquiryId={selectedId}
                isAdmin={isAdmin}
                onStatusChange={(status) => patchMutation.mutate({ id: selectedId, body: { status } })}
                onEditSignature={() => setEditingSignature(true)}
                onOpenStakeholder={onOpenStakeholder}
              />
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-10">
                <Mail size={28} className="text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-slate-500 text-sm">Select an enquiry to read the conversation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ThreadView({
  projectId, enquiryId, isAdmin, onStatusChange, onEditSignature, onOpenStakeholder,
}: {
  projectId: string
  enquiryId: string
  isAdmin: boolean
  onStatusChange: (status: EnquiryStatus) => void
  onEditSignature: () => void
  onOpenStakeholder?: (stakeholderId: string) => void
}) {
  const queryClient = useQueryClient()
  const [reply, setReply] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCopies, setShowCopies] = useState(false)

  const { data, isLoading, error } = useQuery<ThreadResponse>({
    queryKey: ['enquiry', projectId, enquiryId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/enquiries/${enquiryId}`),
  })

  const sendReply = useMutation({
    mutationFn: (body: string) =>
      fetchJson(`/api/projects/${projectId}/enquiries/${enquiryId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, cc, bcc }),
      }),
    onSuccess: (res: { delivery?: 'sent' | 'skipped' | 'failed' }) => {
      setReply('')
      setCc('')
      setBcc('')
      setShowCopies(false)
      queryClient.invalidateQueries({ queryKey: ['enquiry', projectId, enquiryId] })
      queryClient.invalidateQueries({ queryKey: ['enquiries', projectId] })
      if (res?.delivery === 'sent') toast.success('Reply sent')
      else if (res?.delivery === 'skipped') toast.success('Reply saved (email sending not configured)')
      else toast.error('Reply saved, but the email failed to send')
    },
    onError: (e: Error) => toast.error(e.message || 'Could not send reply'),
  })

  const submitReply = () => {
    const body = reply.trim()
    if (body && !sendReply.isPending) sendReply.mutate(body)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }
  if (error || !data) {
    return <div className="p-6 text-sm text-slate-500">Couldn’t load this enquiry.</div>
  }

  const { enquiry, thread, contacts } = data

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{enquiry.subject}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Mail size={13} aria-hidden="true" />
                <a href={`mailto:${enquiry.submitterEmail}`} className="hover:text-slate-700 hover:underline">
                  {enquiry.channel === 'outbound' && 'To '}
                  {enquiry.submitterName === enquiry.submitterEmail
                    ? enquiry.submitterEmail
                    : `${enquiry.submitterName} · ${enquiry.submitterEmail}`}
                </a>
              </span>
              {enquiry.submitterOrg && (
                <span className="inline-flex items-center gap-1"><Building2 size={13} aria-hidden="true" />{enquiry.submitterOrg}</span>
              )}
              {enquiry.submitterPhone && (
                <span className="inline-flex items-center gap-1"><Phone size={13} aria-hidden="true" />{enquiry.submitterPhone}</span>
              )}
            </div>
          </div>
          {isAdmin ? (
            <select
              value={enquiry.status}
              onChange={e => onStatusChange(e.target.value as EnquiryStatus)}
              aria-label="Enquiry status"
              className="text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white text-slate-700 focus:ring-green-500 focus:border-green-500"
            >
              <option value="new">New</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          ) : (
            <StatusBadge status={enquiry.status} />
          )}
        </div>
        <ThreadContacts
          projectId={projectId}
          enquiryId={enquiryId}
          contacts={contacts}
          submitter={{ address: enquiry.submitterEmail, organization: enquiry.submitterOrg }}
          isAdmin={isAdmin}
          onOpenStakeholder={onOpenStakeholder}
        />
        {enquiry.channel !== 'outbound' && (
          <div className="mt-2">
            <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">
              {enquiry.category}
            </span>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-22rem)]">
        {thread.map(entry => {
          const outbound = entry.direction === 'outbound'
          return (
            <div key={entry.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                outbound ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}>
                <div className={`flex items-center gap-1.5 text-xs mb-1 ${outbound ? 'text-green-50' : 'text-slate-500'}`}>
                  {outbound ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                  <span className="font-medium">{entry.authorName || (outbound ? 'You' : 'Correspondent')}</span>
                  {entry.isOriginal && <span className="opacity-75">· original enquiry</span>}
                </div>
                {(entry.cc?.length > 0 || entry.bcc?.length > 0) && (
                  <div className={`text-xs mb-1 ${outbound ? 'text-green-50' : 'text-slate-500'}`}>
                    {entry.cc?.length > 0 && <div>Cc: {entry.cc.join(', ')}</div>}
                    {entry.bcc?.length > 0 && <div>Bcc: {entry.bcc.join(', ')}</div>}
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">{entry.body}</p>
                <div className={`flex items-center gap-1.5 justify-end mt-1 text-[11px] ${outbound ? 'text-green-100' : 'text-slate-400'}`}>
                  <span>{formatWhen(entry.createdAt)}</span>
                  {outbound && <DeliveryTick status={entry.deliveryStatus} />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Reply composer */}
      {isAdmin ? (
        <div className="p-3 border-t border-slate-100 bg-white">
          <textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitReply() } }}
            rows={3}
            placeholder={`Reply to ${enquiry.submitterName}…`}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
          />
          {showCopies && (
            <div className="mt-2">
              <CopyFields cc={cc} bcc={bcc} onCcChange={setCc} onBccChange={setBcc} />
            </div>
          )}
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="truncate">To {enquiry.submitterEmail}</span>
                {!showCopies && (
                  <button type="button" onClick={() => setShowCopies(true)} className="text-slate-500 hover:text-slate-700 hover:underline flex-shrink-0">
                    Cc / Bcc
                  </button>
                )}
              </div>
              <SignaturePreview onEdit={onEditSignature} />
            </div>
            <button
              onClick={submitReply}
              disabled={!reply.trim() || sendReply.isPending}
              className="btn-primary text-sm disabled:opacity-50 flex-shrink-0"
            >
              {sendReply.isPending ? <Spinner size="sm" /> : <Send size={15} aria-hidden="true" />}
              {sendReply.isPending ? 'Sending…' : 'Send reply'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 border-t border-slate-100 bg-slate-50 text-center text-xs text-slate-400">
          View-only access — use the contact details above to reply.
        </div>
      )}
    </div>
  )
}

// Stakeholder status of each person on the thread: a link to their record, or
// an add form prefilled from the email (and with the organisation when a
// colleague at the same email domain is already registered).
function ThreadContacts({
  projectId, enquiryId, contacts, submitter, isAdmin, onOpenStakeholder,
}: {
  projectId: string
  enquiryId: string
  contacts: ThreadContact[]
  submitter: { address: string; organization: string | null }
  isAdmin: boolean
  onOpenStakeholder?: (stakeholderId: string) => void
}) {
  const [adding, setAdding] = useState<ThreadContact | null>(null)

  const shown = contacts.filter(c => c.stakeholder || isAdmin)
  if (shown.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {shown.map(contact =>
        contact.stakeholder ? (
          <button
            key={contact.address}
            onClick={() => onOpenStakeholder?.(contact.stakeholder!.id)}
            disabled={!onOpenStakeholder}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100"
            title={contact.address}
          >
            <Users size={12} aria-hidden="true" /> {contact.stakeholder.name}
          </button>
        ) : (
          <button
            key={contact.address}
            onClick={() => setAdding(contact)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50"
            title={contact.address}
          >
            <UserPlus size={12} aria-hidden="true" />
            Add {contact.name || contact.address} as stakeholder
            {contact.sameOrganisation && <span className="text-slate-400">· {contact.sameOrganisation.organization}</span>}
          </button>
        )
      )}
      {adding && (
        <AddStakeholderModal
          projectId={projectId}
          enquiryId={enquiryId}
          contact={adding}
          organization={
            adding.sameOrganisation?.organization ??
            (adding.address === submitter.address.toLowerCase() ? submitter.organization : null)
          }
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  )
}

// Quick picks for how someone relates to the project; each sets the
// stakeholder's role text and register type.
const RELATIONSHIPS = [
  { label: 'Site neighbour', type: 'individual' },
  { label: 'Local resident', type: 'individual' },
  { label: 'Local business', type: 'business' },
  { label: 'Community group', type: 'community' },
  { label: 'Councillor', type: 'authority' },
  { label: 'Statutory consultee', type: 'authority' },
] as const
const STAKEHOLDER_TYPES = ['individual', 'organisation', 'business', 'community', 'authority', 'other'] as const
const STANCES = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'supporter', label: 'Supporter' },
  { value: 'opposed', label: 'Opposed' },
  { value: 'undecided', label: 'Undecided' },
] as const

function AddStakeholderModal({
  projectId, enquiryId, contact, organization, onClose,
}: {
  projectId: string
  enquiryId: string
  contact: ThreadContact
  organization: string | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: contact.name ?? '',
    organization: organization ?? '',
    role: '',
    type: contact.sameOrganisation?.type ?? 'individual',
    category: 'neutral',
  })
  const set = (key: keyof typeof form, value: string) => setForm(f => ({ ...f, [key]: value }))

  const add = useMutation({
    mutationFn: () =>
      fetchJson(`/api/projects/${projectId}/stakeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || contact.address,
          email: contact.address,
          organization: form.organization.trim() || null,
          role: form.role.trim() || null,
          type: form.type,
          category: form.category,
        }),
      }),
    onSuccess: () => {
      toast.success('Stakeholder added — their emails are now in the engagement log')
      queryClient.invalidateQueries({ queryKey: ['enquiry', projectId, enquiryId] })
      queryClient.invalidateQueries({ queryKey: ['stakeholders', projectId] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Could not add stakeholder'),
  })

  return (
    <ModalShell onClose={onClose} label="Add as stakeholder">
      <form onSubmit={e => { e.preventDefault(); if (!add.isPending) add.mutate() }} className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Add as stakeholder</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-500">{contact.address}</p>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1.5">Relationship to the project</span>
          <div className="flex flex-wrap gap-1.5">
            {RELATIONSHIPS.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => setForm(f => ({ ...f, role: r.label, type: r.type }))}
                aria-pressed={form.role === r.label}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  form.role === r.label
                    ? 'bg-green-50 border-green-300 text-green-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Name</span>
            <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder={contact.address} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Role</span>
            <input value={form.role} onChange={e => set('role', e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Organisation</span>
            <input value={form.organization} onChange={e => set('organization', e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Type</span>
            <select value={form.type} onChange={e => set('type', e.target.value)} className="input capitalize">
              {STAKEHOLDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Stance</span>
            <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
              {STANCES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={add.isPending} className="btn-primary flex items-center gap-2">
            {add.isPending ? <Spinner size="sm" /> : <UserPlus size={16} aria-hidden="true" />}
            Add stakeholder
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
