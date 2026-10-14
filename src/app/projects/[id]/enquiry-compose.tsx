'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { ModalShell } from '@/components/ModalShell'
import { toast } from 'sonner'
import { Send, X } from 'lucide-react'

// Composer pieces for the enquiry desk: new outbound emails, CC/BCC fields
// and the sender's personal signature.

const signatureKey = ['me', 'signature']

export function useSignature() {
  return useQuery<{ signature: string }>({
    queryKey: signatureKey,
    queryFn: () => fetchJson('/api/me/signature'),
    staleTime: 5 * 60_000,
  })
}

export function SignaturePreview({ onEdit }: { onEdit: () => void }) {
  const { data } = useSignature()
  const signature = data?.signature ?? ''
  if (!signature) {
    return (
      <button type="button" onClick={onEdit} className="text-xs text-slate-500 hover:text-slate-700 hover:underline">
        Add a signature
      </button>
    )
  }
  return (
    <div className="text-xs text-slate-500">
      <div className="flex items-center gap-2">
        <span className="font-medium">Signature</span>
        <button type="button" onClick={onEdit} className="hover:text-slate-700 hover:underline">Edit</button>
      </div>
      <p className="whitespace-pre-wrap text-slate-400 mt-0.5 line-clamp-3">{signature}</p>
    </div>
  )
}

export function CopyFields({
  cc, bcc, onCcChange, onBccChange,
}: {
  cc: string
  bcc: string
  onCcChange: (value: string) => void
  onBccChange: (value: string) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Cc</span>
        <input value={cc} onChange={e => onCcChange(e.target.value)} className="input text-sm" placeholder="name@example.com, …" />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Bcc</span>
        <input value={bcc} onChange={e => onBccChange(e.target.value)} className="input text-sm" placeholder="name@example.com, …" />
      </label>
    </div>
  )
}

export function SignatureModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useSignature()
  const [draft, setDraft] = useState<string | null>(null)
  const value = draft ?? data?.signature ?? ''

  const save = useMutation({
    mutationFn: () =>
      fetchJson<{ signature: string }>('/api/me/signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: value }),
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(signatureKey, res)
      toast.success('Signature saved')
      onClose()
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save signature'),
  })

  return (
    <ModalShell onClose={onClose} label="Email signature">
      <form onSubmit={e => { e.preventDefault(); save.mutate() }} className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Email signature</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (
          <textarea
            autoFocus
            value={value}
            onChange={e => setDraft(e.target.value)}
            className="input min-h-[140px] text-sm"
            maxLength={2000}
            placeholder={'Jane Smith\nCommunity Engagement Lead\n01234 567890'}
          />
        )}
        <p className="text-xs text-slate-400">Added to the end of every enquiry email you send, on all projects.</p>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isLoading || save.isPending} className="btn-primary">
            {save.isPending ? <Spinner size="sm" /> : 'Save signature'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

interface StakeholderContact {
  id: string
  name: string
  email: string | null
  organization: string | null
}

export function NewEmailModal({
  projectId, onClose, onSent, onEditSignature,
}: {
  projectId: string
  onClose: () => void
  onSent: (enquiryId: string) => void
  onEditSignature: () => void
}) {
  const [to, setTo] = useState('')
  const [toName, setToName] = useState('')
  const [cc, setCc] = useState('')
  const [bcc, setBcc] = useState('')
  const [showCopies, setShowCopies] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Stakeholders with an email address double as an address book.
  const { data: stakeholderData } = useQuery<{ stakeholders: StakeholderContact[] }>({
    queryKey: ['stakeholders', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/stakeholders`),
  })
  const contacts = (stakeholderData?.stakeholders ?? []).filter(s => s.email)

  const pickRecipient = (value: string) => {
    setTo(value)
    const match = contacts.find(c => c.email?.toLowerCase() === value.trim().toLowerCase())
    if (match && !toName) setToName(match.name)
  }

  const send = useMutation({
    mutationFn: () =>
      fetchJson<{ id: string; delivery: 'sent' | 'skipped' | 'failed' }>(`/api/projects/${projectId}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, toName, cc, bcc, subject, body }),
      }),
    onSuccess: (res) => {
      if (res.delivery === 'sent') toast.success('Email sent')
      else if (res.delivery === 'skipped') toast.success('Email saved (email sending not configured)')
      else toast.error('Email saved, but it failed to send')
      onSent(res.id)
    },
    onError: (e: Error) => toast.error(e.message || 'Could not send email'),
  })

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) && subject.trim() && body.trim()

  return (
    <ModalShell onClose={onClose} label="New email">
      <form onSubmit={e => { e.preventDefault(); if (valid && !send.isPending) send.mutate() }} className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">New email</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="compose-to" className="block text-sm font-medium text-slate-700 mb-1">To</label>
            <input
              id="compose-to"
              autoFocus
              type="email"
              list="compose-contacts"
              value={to}
              onChange={e => pickRecipient(e.target.value)}
              onBlur={e => pickRecipient(e.target.value)}
              className="input"
              placeholder="name@example.com"
            />
            <datalist id="compose-contacts">
              {contacts.map(c => (
                <option key={c.id} value={c.email!}>{c.name}{c.organization ? ` · ${c.organization}` : ''}</option>
              ))}
            </datalist>
          </div>
          <div>
            <label htmlFor="compose-name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input id="compose-name" value={toName} onChange={e => setToName(e.target.value)} className="input" maxLength={200} />
          </div>
        </div>
        {showCopies ? (
          <CopyFields cc={cc} bcc={bcc} onCcChange={setCc} onBccChange={setBcc} />
        ) : (
          <button type="button" onClick={() => setShowCopies(true)} className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
            Add Cc / Bcc
          </button>
        )}
        <div>
          <label htmlFor="compose-subject" className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input id="compose-subject" value={subject} onChange={e => setSubject(e.target.value)} className="input" maxLength={300} />
        </div>
        <div>
          <label htmlFor="compose-body" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
          <textarea
            id="compose-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            className="input min-h-[200px]"
            maxLength={10000}
          />
        </div>
        <SignaturePreview onEdit={onEditSignature} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!valid || send.isPending} className="btn-primary flex items-center gap-2">
            {send.isPending ? <Spinner size="sm" /> : <Send size={16} aria-hidden="true" />}
            {send.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
