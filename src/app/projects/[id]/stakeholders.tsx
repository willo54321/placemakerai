'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { toast } from 'sonner'
import {
  Users, Plus, Building2, Mail, Phone, Trash2, X, Pencil,
  MessageSquare, CalendarDays, ArrowRight, Inbox, Target,
} from 'lucide-react'

// ---- domain vocab -----------------------------------------------------------

type Category = 'supporter' | 'neutral' | 'opposed' | 'undecided'
const CATEGORIES: Category[] = ['supporter', 'neutral', 'opposed', 'undecided']
const CATEGORY_META: Record<Category, { label: string; className: string }> = {
  supporter: { label: 'Supporter', className: 'bg-green-100 text-green-700' },
  neutral:   { label: 'Neutral',   className: 'bg-slate-100 text-slate-600' },
  opposed:   { label: 'Opposed',   className: 'bg-red-100 text-red-700' },
  undecided: { label: 'Undecided', className: 'bg-amber-100 text-amber-700' },
}

const TYPES = ['individual', 'organisation', 'business', 'community', 'authority', 'other'] as const
const ENGAGEMENT_TYPES = ['meeting', 'call', 'email', 'letter', 'event', 'other'] as const

interface StakeholderRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  organization: string | null
  role: string | null
  category: Category
  type: string
  influence: number | null
  interest: number | null
  engagementCount: number
  lastEngagedAt: string | null
}

interface Engagement {
  id: string
  type: string
  title: string
  description: string | null
  date: string
  outcome: string | null
  nextAction: string | null
}

interface StakeholderDetail extends StakeholderRow {
  notes: string | null
  latitude: number | null
  longitude: number | null
  engagements: Engagement[]
  relatedEnquiries: Array<{ id: string; subject: string; status: string; createdAt: string }>
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function CategoryBadge({ category }: { category: Category }) {
  const meta = CATEGORY_META[category] ?? CATEGORY_META.neutral
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>
      {meta.label}
    </span>
  )
}

// ---- power / interest matrix ------------------------------------------------

const STANCE_DOT: Record<Category, string> = {
  supporter: '#16A34A',
  opposed: '#DC2626',
  neutral: '#64748B',
  undecided: '#D97706',
}

const QUADRANTS = [
  { label: 'Keep satisfied', hint: 'High influence · low interest', pos: 'top-0 left-0', bg: 'bg-amber-50/60' },
  { label: 'Manage closely', hint: 'High influence · high interest', pos: 'top-0 right-0', bg: 'bg-green-50/70' },
  { label: 'Monitor', hint: 'Low influence · low interest', pos: 'bottom-0 left-0', bg: 'bg-slate-50' },
  { label: 'Keep informed', hint: 'Low influence · high interest', pos: 'bottom-0 right-0', bg: 'bg-blue-50/60' },
]

function StakeholderMatrix({
  stakeholders,
  onSelect,
}: {
  stakeholders: StakeholderRow[]
  onSelect: (id: string) => void
}) {
  const mapped = stakeholders.filter(s => s.influence != null && s.interest != null)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Target size={18} className="text-green-600" aria-hidden="true" />
            Power / interest matrix
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Where to focus engagement — each stakeholder plotted by influence and interest.
          </p>
        </div>
        <span className="text-xs text-slate-400">{mapped.length} of {stakeholders.length} mapped</span>
      </div>

      <div className="flex gap-3">
        {/* Y axis label */}
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-slate-500 [writing-mode:vertical-rl] rotate-180">Influence →</span>
        </div>

        <div className="flex-1">
          <div className="relative w-full aspect-square max-w-[520px] mx-auto rounded-lg border border-slate-200 overflow-hidden">
            {/* quadrant backgrounds */}
            {QUADRANTS.map(q => (
              <div key={q.label} className={`absolute w-1/2 h-1/2 ${q.pos} ${q.bg} flex items-start justify-start`}>
                <div className="p-2">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{q.label}</div>
                  <div className="text-[10px] text-slate-400">{q.hint}</div>
                </div>
              </div>
            ))}
            {/* centre grid lines */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
            <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200" />

            {/* dots */}
            {mapped.map((s, i) => {
              // 1–5 → 0..100%. Interest = x, Influence = y (5 at top).
              const jitter = ((i % 3) - 1) * 1.4
              const x = ((s.interest! - 0.5) / 5) * 100 + jitter
              const y = (1 - (s.influence! - 0.5) / 5) * 100 + jitter
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  title={`${s.name}${s.role ? ` · ${s.role}` : ''} (influence ${s.influence}, interest ${s.interest})`}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-150 focus:scale-150 focus:outline-none z-10"
                  style={{ left: `${x}%`, top: `${y}%`, background: STANCE_DOT[s.category] ?? STANCE_DOT.neutral }}
                >
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 -top-7 hidden group-hover:block whitespace-nowrap rounded bg-slate-900 px-2 py-0.5 text-[10px] text-white">
                    {s.name}
                  </span>
                </button>
              )
            })}
          </div>
          {/* X axis label */}
          <div className="text-center mt-1.5 text-xs font-medium text-slate-500">Interest →</div>
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-100">
        {CATEGORIES.map(c => (
          <span key={c} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STANCE_DOT[c] }} />
            {CATEGORY_META[c].label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---- main tab ---------------------------------------------------------------

export function StakeholdersTab({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [view, setView] = useState<'register' | 'matrix'>('register')

  const listKey = ['stakeholders', projectId]
  const { data, isLoading, error } = useQuery<{ stakeholders: StakeholderRow[] }>({
    queryKey: listKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/stakeholders`),
  })

  const stakeholders = data?.stakeholders ?? []
  const filtered = useMemo(
    () => stakeholders.filter(s => categoryFilter === 'all' || s.category === categoryFilter),
    [stakeholders, categoryFilter]
  )

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson(`/api/projects/${projectId}/stakeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: (created: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: listKey })
      setAdding(false)
      setSelectedId(created.id)
      toast.success('Stakeholder added')
    },
    onError: (e: Error) => toast.error(e.message || 'Could not add stakeholder'),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  }
  if (error) {
    return <div className="card p-6 text-center text-slate-600">Couldn’t load stakeholders. {(error as Error).message}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Users size={20} className="text-green-600" aria-hidden="true" />
            Stakeholders
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            The named contacts and organisations you engage with directly — your consultation audit trail.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => { setAdding(true); setSelectedId(null) }} className="btn-primary">
            <Plus size={18} aria-hidden="true" />
            Add stakeholder
          </button>
        )}
      </div>

      {stakeholders.length > 0 && (
        <div className="flex items-center gap-1 border-b border-slate-200" role="tablist" aria-label="Stakeholder views">
          {(['register', 'matrix'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              role="tab"
              aria-selected={view === v}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                view === v ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {v === 'register' ? 'Register' : 'Power / interest matrix'}
            </button>
          ))}
        </div>
      )}

      {view === 'matrix' ? (
        <StakeholderMatrix
          stakeholders={stakeholders}
          onSelect={(id) => { setSelectedId(id); setView('register') }}
        />
      ) : stakeholders.length === 0 && !adding ? (
        <div className="card p-10 text-center">
          <Users size={32} className="mx-auto text-slate-300 mb-3" aria-hidden="true" />
          <p className="text-slate-600 font-medium">No stakeholders yet</p>
          <p className="text-sm text-slate-400 mt-1">
            Add the people and organisations you’re engaging with to build a record of every interaction.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,420px)_1fr] gap-4">
          {/* Register */}
          <div className="card overflow-hidden flex flex-col">
            <div className="p-3 border-b border-slate-100 flex items-center gap-1 flex-wrap" role="tablist" aria-label="Filter by stance">
              {(['all', ...CATEGORIES] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  role="tab"
                  aria-selected={categoryFilter === c}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    categoryFilter === c ? 'bg-green-50 text-green-700' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {c === 'all' ? 'All' : CATEGORY_META[c].label}
                </button>
              ))}
            </div>
            <ul className="overflow-y-auto divide-y divide-slate-100 max-h-[calc(100vh-16rem)]">
              {filtered.length === 0 && (
                <li className="p-6 text-center text-sm text-slate-400">No stakeholders match this filter.</li>
              )}
              {filtered.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => { setSelectedId(s.id); setAdding(false) }}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      selectedId === s.id ? 'bg-green-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{s.name}</span>
                      <CategoryBadge category={s.category} />
                    </div>
                    {(s.organization || s.role) && (
                      <p className="text-sm text-slate-500 truncate mt-0.5">
                        {[s.role, s.organization].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare size={11} /> {s.engagementCount}
                      </span>
                      {s.lastEngagedAt && <span>· last {fmtDate(s.lastEngagedAt)}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Detail / add */}
          <div className="card overflow-hidden">
            {adding ? (
              <AddStakeholderForm
                onCancel={() => setAdding(false)}
                onSubmit={body => createMutation.mutate(body)}
                submitting={createMutation.isPending}
              />
            ) : selectedId ? (
              <StakeholderDetailPanel
                key={selectedId}
                projectId={projectId}
                stakeholderId={selectedId}
                isAdmin={isAdmin}
                onDeleted={() => { setSelectedId(null); queryClient.invalidateQueries({ queryKey: listKey }) }}
              />
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-10">
                <Users size={28} className="text-slate-300 mb-3" aria-hidden="true" />
                <p className="text-slate-500 text-sm">Select a stakeholder, or add a new one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- add stakeholder --------------------------------------------------------

function AddStakeholderForm({
  onCancel, onSubmit, submitting,
}: {
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
  submitting: boolean
}) {
  const [form, setForm] = useState({
    name: '', organization: '', role: '', email: '', phone: '',
    category: 'neutral' as Category, type: 'other',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (form.name.trim()) onSubmit(form) }}
      className="p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">New stakeholder</h3>
        <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600" aria-label="Cancel">
          <X size={18} />
        </button>
      </div>
      <Field label="Name" required>
        <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} className="input" placeholder="Jane Smith" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Organisation"><input value={form.organization} onChange={e => set('organization', e.target.value)} className="input" /></Field>
        <Field label="Role"><input value={form.role} onChange={e => set('role', e.target.value)} className="input" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stance">
          <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
            {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value)} className="input capitalize">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={!form.name.trim() || submitting} className="btn-primary">
          {submitting ? <Spinner size="sm" /> : 'Add stakeholder'}
        </button>
      </div>
    </form>
  )
}

// ---- detail panel -----------------------------------------------------------

function StakeholderDetailPanel({
  projectId, stakeholderId, isAdmin, onDeleted,
}: {
  projectId: string
  stakeholderId: string
  isAdmin: boolean
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const detailKey = ['stakeholder', projectId, stakeholderId]
  const listKey = ['stakeholders', projectId]
  const [editing, setEditing] = useState(false)

  const { data: s, isLoading, error } = useQuery<StakeholderDetail>({
    queryKey: detailKey,
    queryFn: () => fetchJson(`/api/projects/${projectId}/stakeholders/${stakeholderId}`),
  })

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson(`/api/projects/${projectId}/stakeholders/${stakeholderId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: detailKey })
      queryClient.invalidateQueries({ queryKey: listKey })
    },
    onError: (e: Error) => toast.error(e.message || 'Update failed'),
  })

  const del = useMutation({
    mutationFn: () => fetchJson(`/api/projects/${projectId}/stakeholders/${stakeholderId}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Stakeholder deleted'); onDeleted() },
    onError: (e: Error) => toast.error(e.message || 'Delete failed'),
  })

  if (isLoading) return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>
  if (error || !s) return <div className="p-6 text-sm text-slate-500">Couldn’t load this stakeholder.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 text-lg truncate">{s.name}</h3>
            {(s.role || s.organization) && (
              <p className="text-sm text-slate-500 mt-0.5 truncate">{[s.role, s.organization].filter(Boolean).join(' · ')}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-slate-500">
              {s.email && (
                <a href={`mailto:${s.email}`} className="inline-flex items-center gap-1 hover:text-slate-700 hover:underline">
                  <Mail size={13} /> {s.email}
                </a>
              )}
              {s.phone && <span className="inline-flex items-center gap-1"><Phone size={13} /> {s.phone}</span>}
              <span className="inline-flex items-center gap-1 capitalize"><Building2 size={13} /> {s.type}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setEditing(v => !v)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100" aria-label="Edit details">
                <Pencil size={16} />
              </button>
              <button
                onClick={() => { if (confirm(`Delete ${s.name}? This removes their engagement history.`)) del.mutate() }}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                aria-label="Delete stakeholder"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Stance + influence/interest — inline editable for admins */}
        <div className="flex flex-wrap items-center gap-4 mt-3">
          {isAdmin ? (
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              Stance
              <select
                value={s.category}
                onChange={e => patch.mutate({ category: e.target.value })}
                className="text-sm rounded-md border border-slate-200 px-2 py-1 bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
            </label>
          ) : (
            <CategoryBadge category={s.category} />
          )}
          <RatingControl label="Influence" value={s.influence} editable={isAdmin} onChange={v => patch.mutate({ influence: v })} />
          <RatingControl label="Interest" value={s.interest} editable={isAdmin} onChange={v => patch.mutate({ interest: v })} />
        </div>

        {editing && isAdmin && (
          <EditDetailsForm
            stakeholder={s}
            onCancel={() => setEditing(false)}
            onSave={body => patch.mutate(body, { onSuccess: () => setEditing(false) })}
            saving={patch.isPending}
          />
        )}
      </div>

      {/* Body: engagements + related enquiries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 max-h-[calc(100vh-24rem)]">
        {s.relatedEnquiries.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Inbox size={13} /> Public enquiries from this email
            </h4>
            <ul className="space-y-1">
              {s.relatedEnquiries.map(e => (
                <li key={e.id} className="text-sm text-slate-600 flex items-center gap-2">
                  <ArrowRight size={12} className="text-slate-300" />
                  <span className="truncate">{e.subject}</span>
                  <span className="text-xs text-slate-400 shrink-0">· {e.status} · {fmtDate(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <EngagementTimeline
          projectId={projectId}
          stakeholderId={stakeholderId}
          engagements={s.engagements}
          isAdmin={isAdmin}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: detailKey })
            queryClient.invalidateQueries({ queryKey: listKey })
          }}
        />
      </div>
    </div>
  )
}

function RatingControl({
  label, value, editable, onChange,
}: {
  label: string
  value: number | null
  editable: boolean
  onChange: (v: number | null) => void
}) {
  if (!editable) {
    return (
      <span className="text-xs text-slate-500">
        {label}: <span className="font-medium text-slate-700">{value ?? '—'}</span>
      </span>
    )
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500">
      {label}
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="text-sm rounded-md border border-slate-200 px-2 py-1 bg-white"
      >
        <option value="">—</option>
        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  )
}

function EditDetailsForm({
  stakeholder, onCancel, onSave, saving,
}: {
  stakeholder: StakeholderDetail
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => void
  saving: boolean
}) {
  const [form, setForm] = useState({
    name: stakeholder.name,
    organization: stakeholder.organization ?? '',
    role: stakeholder.role ?? '',
    email: stakeholder.email ?? '',
    phone: stakeholder.phone ?? '',
    type: stakeholder.type,
    notes: stakeholder.notes ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input value={form.name} onChange={e => set('name', e.target.value)} className="input" /></Field>
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value)} className="input capitalize">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Organisation"><input value={form.organization} onChange={e => set('organization', e.target.value)} className="input" /></Field>
        <Field label="Role"><input value={form.role} onChange={e => set('role', e.target.value)} className="input" /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" /></Field>
        <Field label="Phone"><input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" /></Field>
      </div>
      <Field label="Notes"><textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="input" /></Field>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <button onClick={() => form.name.trim() && onSave(form)} disabled={!form.name.trim() || saving} className="btn-primary">
          {saving ? <Spinner size="sm" /> : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ---- engagements ------------------------------------------------------------

function EngagementTimeline({
  projectId, stakeholderId, engagements, isAdmin, onChanged,
}: {
  projectId: string
  stakeholderId: string
  engagements: Engagement[]
  isAdmin: boolean
  onChanged: () => void
}) {
  const [adding, setAdding] = useState(false)

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetchJson(`/api/projects/${projectId}/stakeholders/${stakeholderId}/engagements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    onSuccess: () => { setAdding(false); onChanged(); toast.success('Engagement logged') },
    onError: (e: Error) => toast.error(e.message || 'Could not log engagement'),
  })

  const del = useMutation({
    mutationFn: (engagementId: string) =>
      fetchJson(`/api/projects/${projectId}/stakeholders/${stakeholderId}/engagements/${engagementId}`, { method: 'DELETE' }),
    onSuccess: () => onChanged(),
    onError: (e: Error) => toast.error(e.message || 'Delete failed'),
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <CalendarDays size={13} /> Engagement log ({engagements.length})
        </h4>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs font-medium text-green-700 hover:text-green-800 inline-flex items-center gap-1">
            <Plus size={13} /> Log engagement
          </button>
        )}
      </div>

      {adding && (
        <AddEngagementForm onCancel={() => setAdding(false)} onSubmit={b => create.mutate(b)} submitting={create.isPending} />
      )}

      {engagements.length === 0 && !adding ? (
        <p className="text-sm text-slate-400">No engagements logged yet.</p>
      ) : (
        <ol className="space-y-3 mt-2">
          {engagements.map(e => (
            <li key={e.id} className="relative pl-4 border-l-2 border-slate-100">
              <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-green-500" />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="text-xs text-slate-400 capitalize">{e.type} · {fmtDate(e.date)}</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => { if (confirm('Delete this engagement?')) del.mutate(e.id) }}
                    className="p-1 text-slate-300 hover:text-red-600 shrink-0" aria-label="Delete engagement"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              {e.description && <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{e.description}</p>}
              {e.outcome && <p className="text-sm text-slate-500 mt-1"><span className="font-medium">Outcome:</span> {e.outcome}</p>}
              {e.nextAction && <p className="text-sm text-amber-700 mt-1"><span className="font-medium">Next:</span> {e.nextAction}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function AddEngagementForm({
  onCancel, onSubmit, submitting,
}: {
  onCancel: () => void
  onSubmit: (body: Record<string, unknown>) => void
  submitting: boolean
}) {
  const [form, setForm] = useState({
    type: 'meeting', title: '', description: '', date: new Date().toISOString().slice(0, 10),
    outcome: '', nextAction: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (form.title.trim()) onSubmit(form) }}
      className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-100 space-y-3"
    >
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <Field label="What happened" required>
          <input autoFocus value={form.title} onChange={e => set('title', e.target.value)} className="input" placeholder="Introductory call" />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={e => set('type', e.target.value)} className="input capitalize">
            {ENGAGEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Date"><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input" /></Field>
      <Field label="Notes"><textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} className="input" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outcome"><input value={form.outcome} onChange={e => set('outcome', e.target.value)} className="input" /></Field>
        <Field label="Next action"><input value={form.nextAction} onChange={e => set('nextAction', e.target.value)} className="input" /></Field>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={!form.title.trim() || submitting} className="btn-primary">
          {submitting ? <Spinner size="sm" /> : 'Log engagement'}
        </button>
      </div>
    </form>
  )
}

// ---- tiny field wrapper -----------------------------------------------------

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}
