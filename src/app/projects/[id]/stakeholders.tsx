'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Edit2, Trash2, X, Users, Search, Filter, ChevronRight,
  Calendar, Mail, Phone, Building, MessageSquare, History, ThumbsUp, ThumbsDown, Minus, Wand2
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface Engagement {
  id: string
  type: string
  title: string
  description: string | null
  date: string
  outcome: string | null
  nextAction: string | null
  createdAt: string
}

interface RelatedEnquiry {
  id: string
  subject: string
  status: string
  createdAt: string
}

interface Stakeholder {
  id: string
  name: string
  email: string | null
  phone: string | null
  organization: string | null
  role: string | null
  type: string
  category: string
  notes: string | null
  influence: number | null
  interest: number | null
  engagements?: Engagement[]
  relatedEnquiries?: RelatedEnquiry[]
}

const STAKEHOLDER_TYPES = [
  { value: 'site_neighbour', label: 'Site Neighbour', icon: '🏠' },
  { value: 'political', label: 'Political', icon: '🏛️' },
  { value: 'community_org', label: 'Community Organisation', icon: '👥' },
  { value: 'business', label: 'Business', icon: '🏢' },
  { value: 'landowner', label: 'Landowner', icon: '📍' },
  { value: 'statutory', label: 'Statutory Body', icon: '📋' },
  { value: 'media', label: 'Media', icon: '📰' },
  { value: 'other', label: 'Other', icon: '👤' },
]

const CATEGORIES = [
  { value: 'supporter', label: 'Supporter', className: 'badge-green', color: 'bg-green-500' },
  { value: 'neutral', label: 'Neutral', className: 'badge-gray', color: 'bg-slate-400' },
  { value: 'opponent', label: 'Opponent', className: 'badge-red', color: 'bg-red-500' },
  { value: 'unknown', label: 'Unknown', className: 'badge-amber', color: 'bg-amber-500' },
]

const ENGAGEMENT_TYPES = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Phone Call' },
  { value: 'event', label: 'Event' },
  { value: 'letter', label: 'Letter' },
  { value: 'site_visit', label: 'Site Visit' },
  { value: 'other', label: 'Other' },
]

const OUTCOMES = [
  { value: 'positive', label: 'Positive', icon: ThumbsUp, className: 'text-green-600' },
  { value: 'neutral', label: 'Neutral', icon: Minus, className: 'text-slate-500' },
  { value: 'negative', label: 'Negative', icon: ThumbsDown, className: 'text-red-600' },
]

export function StakeholderTab({ projectId, stakeholders }: { projectId: string; stakeholders: Stakeholder[] }) {
  const queryClient = useQueryClient()
  const { canManageStakeholders } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Stakeholder | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [selectedStakeholder, setSelectedStakeholder] = useState<string | null>(null)
  const [showEngagementForm, setShowEngagementForm] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    role: '',
    type: 'other',
    category: 'neutral',
    notes: '',
    influence: '',
    interest: '',
  })
  const [engagementForm, setEngagementForm] = useState({
    type: 'meeting',
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    outcome: '',
    nextAction: '',
  })

  // Fetch stakeholder detail with engagements
  const { data: stakeholderDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['stakeholder', projectId, selectedStakeholder],
    queryFn: () =>
      fetch(`/api/projects/${projectId}/stakeholders/${selectedStakeholder}`).then(r => r.json()),
    enabled: !!selectedStakeholder,
  })

  // Focus name input when form opens
  useEffect(() => {
    if (showForm && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showForm])

  const createStakeholder = useMutation({
    mutationFn: (data: typeof form) =>
      fetch(`/api/projects/${projectId}/stakeholders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          influence: data.influence ? parseInt(data.influence) : null,
          interest: data.interest ? parseInt(data.interest) : null,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      resetForm()
    },
  })

  const updateStakeholder = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      fetch(`/api/projects/${projectId}/stakeholders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          influence: data.influence ? parseInt(data.influence) : null,
          interest: data.interest ? parseInt(data.interest) : null,
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      if (selectedStakeholder) {
        queryClient.invalidateQueries({ queryKey: ['stakeholder', projectId, selectedStakeholder] })
      }
      resetForm()
    },
  })

  const deleteStakeholder = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/stakeholders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setDeleteConfirm(null)
      if (selectedStakeholder) {
        setSelectedStakeholder(null)
      }
    },
  })

  const createEngagement = useMutation({
    mutationFn: (data: typeof engagementForm) =>
      fetch(`/api/projects/${projectId}/stakeholders/${selectedStakeholder}/engagements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholder', projectId, selectedStakeholder] })
      setShowEngagementForm(false)
      setEngagementForm({
        type: 'meeting',
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        outcome: '',
        nextAction: '',
      })
    },
  })

  const deleteEngagement = useMutation({
    mutationFn: (engagementId: string) =>
      fetch(`/api/projects/${projectId}/stakeholders/${selectedStakeholder}/engagements/${engagementId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholder', projectId, selectedStakeholder] })
    },
  })

  // Auto-detect stakeholders state
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [autoDetectResult, setAutoDetectResult] = useState<{
    message: string
    created: number
    skipped: number
  } | null>(null)

  const autoDetectStakeholders = useMutation({
    mutationFn: async () => {
      setAutoDetecting(true)
      setAutoDetectResult(null)
      const response = await fetch(`/api/projects/${projectId}/stakeholders/auto-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to auto-detect stakeholders')
      }
      return response.json()
    },
    onSuccess: (data) => {
      setAutoDetectResult(data)
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onError: (error: Error) => {
      setAutoDetectResult({
        message: error.message,
        created: 0,
        skipped: 0
      })
    },
    onSettled: () => {
      setAutoDetecting(false)
    }
  })

  const resetForm = () => {
    setShowForm(false)
    setEditing(null)
    setForm({ name: '', email: '', phone: '', organization: '', role: '', type: 'other', category: 'neutral', notes: '', influence: '', interest: '' })
  }

  const startEdit = (s: Stakeholder) => {
    setEditing(s)
    setForm({
      name: s.name,
      email: s.email || '',
      phone: s.phone || '',
      organization: s.organization || '',
      role: s.role || '',
      type: s.type || 'other',
      category: s.category,
      notes: s.notes || '',
      influence: s.influence?.toString() || '',
      interest: s.interest?.toString() || '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateStakeholder.mutate({ id: editing.id, data: form })
    } else {
      createStakeholder.mutate(form)
    }
  }

  // Calculate stats
  const stats = CATEGORIES.map(cat => ({
    ...cat,
    count: stakeholders.filter(s => s.category === cat.value).length,
  }))

  // Filter stakeholders
  const filteredStakeholders = stakeholders.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.organization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || s.type === typeFilter
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter
    return matchesSearch && matchesType && matchesCategory
  })

  return (
    <div>
      {/* Main list panel */}
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Stakeholders</h2>
            <p className="text-sm text-slate-600">Track and manage project stakeholders</p>
          </div>
          {canManageStakeholders && (
            <div className="flex gap-2">
              <button
                onClick={() => autoDetectStakeholders.mutate()}
                disabled={autoDetecting}
                className="btn-secondary"
                title="Auto-detect MPs, councillors, and parish councils based on project location"
              >
                {autoDetecting ? (
                  <>
                    <span className="animate-spin w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} aria-hidden="true" />
                    Auto-detect
                  </>
                )}
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="btn-primary"
                aria-haspopup="dialog"
              >
                <Plus size={18} aria-hidden="true" />
                Add Stakeholder
              </button>
            </div>
          )}
        </div>

        {/* Auto-detect result message */}
        {autoDetectResult && (
          <div className={`card p-4 mb-4 ${autoDetectResult.created > 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-sm font-medium ${autoDetectResult.created > 0 ? 'text-green-800' : 'text-amber-800'}`}>
                  {autoDetectResult.message}
                </p>
                {autoDetectResult.created > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Created: {autoDetectResult.created} | Skipped (already exist): {autoDetectResult.skipped}
                  </p>
                )}
              </div>
              <button
                onClick={() => setAutoDetectResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Stats cards */}
        {stakeholders.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {stats.map(stat => (
              <button
                key={stat.value}
                onClick={() => setCategoryFilter(categoryFilter === stat.value ? 'all' : stat.value)}
                className={`card p-4 text-left transition-all ${
                  categoryFilter === stat.value ? 'ring-2 ring-blue-500' : 'hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${stat.color}`} />
                  <span className="text-sm font-medium text-slate-700">{stat.label}</span>
                </div>
                <span className="text-2xl font-semibold text-slate-900">{stat.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search and filter */}
        {stakeholders.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search stakeholders..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input pl-10"
                aria-label="Search stakeholders"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="input"
              aria-label="Filter by type"
            >
              <option value="all">All Types</option>
              {STAKEHOLDER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
              ))}
            </select>
            <div className="relative">
              <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="input pl-9 pr-8 appearance-none"
                aria-label="Filter by stance"
              >
                <option value="all">All Stances</option>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Add/Edit form modal */}
        {showForm && (
          <>
            <div
              className="modal-overlay"
              onClick={resetForm}
              aria-hidden="true"
            />
            <div
              className="modal"
              role="dialog"
              aria-labelledby="stakeholder-form-title"
              aria-modal="true"
            >
              <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 id="stakeholder-form-title" className="text-lg font-semibold text-slate-900">
                    {editing ? 'Edit Stakeholder' : 'Add Stakeholder'}
                  </h3>
                  <button
                    onClick={resetForm}
                    className="btn-icon"
                    aria-label="Close dialog"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="stakeholder-name" className="label label-required">
                        Name
                      </label>
                      <input
                        ref={nameInputRef}
                        id="stakeholder-name"
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="input"
                        placeholder="Full name"
                        required
                        aria-required="true"
                      />
                    </div>

                    <div>
                      <label htmlFor="stakeholder-email" className="label">
                        Email
                      </label>
                      <input
                        id="stakeholder-email"
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        className="input"
                        placeholder="email@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="stakeholder-phone" className="label">
                        Phone
                      </label>
                      <input
                        id="stakeholder-phone"
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="input"
                        placeholder="+44 7700 900000"
                      />
                    </div>

                    <div>
                      <label htmlFor="stakeholder-org" className="label">
                        Organization
                      </label>
                      <input
                        id="stakeholder-org"
                        type="text"
                        value={form.organization}
                        onChange={e => setForm({ ...form, organization: e.target.value })}
                        className="input"
                        placeholder="Company or organization"
                      />
                    </div>

                    <div>
                      <label htmlFor="stakeholder-role" className="label">
                        Role
                      </label>
                      <input
                        id="stakeholder-role"
                        type="text"
                        value={form.role}
                        onChange={e => setForm({ ...form, role: e.target.value })}
                        className="input"
                        placeholder="Job title or role"
                      />
                    </div>

                    <div>
                      <label htmlFor="stakeholder-type" className="label">
                        Type
                      </label>
                      <select
                        id="stakeholder-type"
                        value={form.type}
                        onChange={e => setForm({ ...form, type: e.target.value })}
                        className="input"
                      >
                        {STAKEHOLDER_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="stakeholder-category" className="label">
                        Stance
                      </label>
                      <select
                        id="stakeholder-category"
                        value={form.category}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                        className="input"
                      >
                        {CATEGORIES.map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="stakeholder-influence" className="label">
                        Influence (1-5)
                      </label>
                      <select
                        id="stakeholder-influence"
                        value={form.influence}
                        onChange={e => setForm({ ...form, influence: e.target.value })}
                        className="input"
                      >
                        <option value="">Not set</option>
                        <option value="1">1 - Very Low</option>
                        <option value="2">2 - Low</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4 - High</option>
                        <option value="5">5 - Very High</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="stakeholder-interest" className="label">
                        Interest (1-5)
                      </label>
                      <select
                        id="stakeholder-interest"
                        value={form.interest}
                        onChange={e => setForm({ ...form, interest: e.target.value })}
                        className="input"
                      >
                        <option value="">Not set</option>
                        <option value="1">1 - Very Low</option>
                        <option value="2">2 - Low</option>
                        <option value="3">3 - Medium</option>
                        <option value="4">4 - High</option>
                        <option value="5">5 - Very High</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="stakeholder-notes" className="label">
                      Notes
                    </label>
                    <textarea
                      id="stakeholder-notes"
                      value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      className="input min-h-[80px] resize-y"
                      placeholder="Additional notes about this stakeholder"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!form.name.trim() || createStakeholder.isPending || updateStakeholder.isPending}
                      className="btn-primary"
                    >
                      {(createStakeholder.isPending || updateStakeholder.isPending) ? (
                        <>
                          <span className="spinner" aria-hidden="true" />
                          {editing ? 'Updating...' : 'Adding...'}
                        </>
                      ) : (
                        editing ? 'Update Stakeholder' : 'Add Stakeholder'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        )}

        {/* Empty state */}
        {stakeholders.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No stakeholders yet</h3>
            <p className="text-slate-600 mb-6 max-w-sm mx-auto">
              Start tracking stakeholders by adding their contact information and engagement status.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              <Plus size={18} aria-hidden="true" />
              Add First Stakeholder
            </button>
          </div>
        ) : filteredStakeholders.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-600">No stakeholders match your search.</p>
          </div>
        ) : (
          /* Stakeholder list */
          <div className="card divide-y divide-slate-100">
            {filteredStakeholders.map(s => {
              const cat = CATEGORIES.find(c => c.value === s.category) || CATEGORIES[1]
              const stakeholderType = STAKEHOLDER_TYPES.find(t => t.value === s.type) || STAKEHOLDER_TYPES[STAKEHOLDER_TYPES.length - 1]
              return (
                <div
                  key={s.id}
                  className={`p-4 flex items-center gap-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                    selectedStakeholder === s.id ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setSelectedStakeholder(s.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedStakeholder(s.id)}
                >
                  <div className={`w-10 h-10 rounded-full ${cat.color} flex items-center justify-center text-white font-medium`}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900 truncate">{s.name}</span>
                      <span className={cat.className}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{stakeholderType.icon} {stakeholderType.label}</span>
                      {(s.organization || s.role) && (
                        <span className="truncate">
                          {s.role ? `- ${s.role}` : ''}{s.role && s.organization ? ' at ' : ''}{s.organization && !s.role ? `- ${s.organization}` : s.organization}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedStakeholder && (
        <>
          <div
            className="modal-overlay"
            onClick={() => setSelectedStakeholder(null)}
            aria-hidden="true"
          />
          <div
            className="modal"
            role="dialog"
            aria-labelledby="stakeholder-detail-title"
            aria-modal="true"
          >
            <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {detailLoading ? (
                <div className="p-8 text-center">
                  <div className="spinner mx-auto" />
                </div>
              ) : stakeholderDetail ? (
                <>
                  {/* Header */}
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-start justify-between mb-3">
                      <button
                        onClick={() => setSelectedStakeholder(null)}
                        className="btn-icon"
                        aria-label="Close detail"
                      >
                        <X size={20} />
                      </button>
                    {canManageStakeholders && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(stakeholderDetail)}
                          className="btn-icon"
                          aria-label="Edit stakeholder"
                        >
                          <Edit2 size={16} />
                        </button>
                        {deleteConfirm === stakeholderDetail.id ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => deleteStakeholder.mutate(stakeholderDetail.id)}
                              className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="text-xs px-2 py-1 bg-slate-200 rounded hover:bg-slate-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(stakeholderDetail.id)}
                            className="btn-icon hover:text-red-600"
                            aria-label="Delete stakeholder"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${CATEGORIES.find(c => c.value === stakeholderDetail.category)?.color || 'bg-slate-400'} flex items-center justify-center text-white text-lg font-medium`}>
                      {stakeholderDetail.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 id="stakeholder-detail-title" className="font-semibold text-slate-900">{stakeholderDetail.name}</h3>
                      {stakeholderDetail.role && (
                        <p className="text-sm text-slate-500">{stakeholderDetail.role}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">
                          {STAKEHOLDER_TYPES.find(t => t.value === stakeholderDetail.type)?.icon}{' '}
                          {STAKEHOLDER_TYPES.find(t => t.value === stakeholderDetail.type)?.label || 'Other'}
                        </span>
                        <span className={CATEGORIES.find(c => c.value === stakeholderDetail.category)?.className || 'badge-gray'}>
                          {CATEGORIES.find(c => c.value === stakeholderDetail.category)?.label || 'Neutral'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="p-4 border-b border-slate-200 space-y-2">
                  {stakeholderDetail.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail size={14} className="text-slate-400" />
                      <a href={`mailto:${stakeholderDetail.email}`} className="text-blue-600 hover:text-blue-700">
                        {stakeholderDetail.email}
                      </a>
                    </div>
                  )}
                  {stakeholderDetail.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone size={14} className="text-slate-400" />
                      <span className="text-slate-600">{stakeholderDetail.phone}</span>
                    </div>
                  )}
                  {stakeholderDetail.organization && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building size={14} className="text-slate-400" />
                      <span className="text-slate-600">{stakeholderDetail.organization}</span>
                    </div>
                  )}
                </div>

                {/* Influence/Interest */}
                {(stakeholderDetail.influence || stakeholderDetail.interest) && (
                  <div className="p-4 border-b border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      {stakeholderDetail.influence && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase mb-1">Influence</div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded ${i <= stakeholderDetail.influence ? 'bg-blue-500' : 'bg-slate-200'}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      {stakeholderDetail.interest && (
                        <div>
                          <div className="text-xs font-medium text-slate-500 uppercase mb-1">Interest</div>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(i => (
                              <div
                                key={i}
                                className={`w-4 h-4 rounded ${i <= stakeholderDetail.interest ? 'bg-brand-500' : 'bg-slate-200'}`}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {stakeholderDetail.notes && (
                  <div className="p-4 border-b border-slate-200">
                    <div className="text-xs font-medium text-slate-500 uppercase mb-2">Notes</div>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{stakeholderDetail.notes}</p>
                  </div>
                )}

                {/* Related Enquiries */}
                {stakeholderDetail.relatedEnquiries && stakeholderDetail.relatedEnquiries.length > 0 && (
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare size={14} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-500 uppercase">Related Enquiries</span>
                    </div>
                    <div className="space-y-2">
                      {stakeholderDetail.relatedEnquiries.map((enq: RelatedEnquiry) => (
                        <div key={enq.id} className="text-sm p-2 bg-slate-50 rounded">
                          <div className="font-medium text-slate-700 truncate">{enq.subject}</div>
                          <div className="text-xs text-slate-500">
                            {enq.status} - {new Date(enq.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Engagement History */}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <History size={14} className="text-slate-400" />
                      <span className="text-xs font-medium text-slate-500 uppercase">Engagement History</span>
                    </div>
                    <button
                      onClick={() => setShowEngagementForm(!showEngagementForm)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      + Log Engagement
                    </button>
                  </div>

                  {/* Engagement form */}
                  {showEngagementForm && (
                    <form
                      onSubmit={e => {
                        e.preventDefault()
                        createEngagement.mutate(engagementForm)
                      }}
                      className="mb-4 p-3 bg-slate-50 rounded-lg space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Type</label>
                          <select
                            value={engagementForm.type}
                            onChange={e => setEngagementForm({ ...engagementForm, type: e.target.value })}
                            className="input mt-1 text-sm py-1.5"
                          >
                            {ENGAGEMENT_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Date</label>
                          <input
                            type="date"
                            value={engagementForm.date}
                            onChange={e => setEngagementForm({ ...engagementForm, date: e.target.value })}
                            className="input mt-1 text-sm py-1.5"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Title</label>
                        <input
                          type="text"
                          value={engagementForm.title}
                          onChange={e => setEngagementForm({ ...engagementForm, title: e.target.value })}
                          className="input mt-1 text-sm py-1.5"
                          placeholder="Brief title"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Description</label>
                        <textarea
                          value={engagementForm.description}
                          onChange={e => setEngagementForm({ ...engagementForm, description: e.target.value })}
                          className="input mt-1 text-sm py-1.5 min-h-[60px]"
                          placeholder="What happened?"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">Outcome</label>
                          <select
                            value={engagementForm.outcome}
                            onChange={e => setEngagementForm({ ...engagementForm, outcome: e.target.value })}
                            className="input mt-1 text-sm py-1.5"
                          >
                            <option value="">Not set</option>
                            {OUTCOMES.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Next Action</label>
                          <input
                            type="text"
                            value={engagementForm.nextAction}
                            onChange={e => setEngagementForm({ ...engagementForm, nextAction: e.target.value })}
                            className="input mt-1 text-sm py-1.5"
                            placeholder="Follow-up"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowEngagementForm(false)}
                          className="text-xs px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!engagementForm.title.trim() || createEngagement.isPending}
                          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {createEngagement.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Engagement list */}
                  {stakeholderDetail.engagements && stakeholderDetail.engagements.length > 0 ? (
                    <div className="space-y-3">
                      {stakeholderDetail.engagements.map((eng: Engagement) => {
                        const outcomeConfig = OUTCOMES.find(o => o.value === eng.outcome)
                        const OutcomeIcon = outcomeConfig?.icon
                        return (
                          <div key={eng.id} className="relative pl-4 border-l-2 border-slate-200">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-700">{eng.title}</span>
                                  {OutcomeIcon && (
                                    <OutcomeIcon size={14} className={outcomeConfig.className} />
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {ENGAGEMENT_TYPES.find(t => t.value === eng.type)?.label || eng.type} - {new Date(eng.date).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={() => deleteEngagement.mutate(eng.id)}
                                className="text-slate-400 hover:text-red-500"
                                aria-label="Delete engagement"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            {eng.description && (
                              <p className="text-xs text-slate-600 mt-1">{eng.description}</p>
                            )}
                            {eng.nextAction && (
                              <div className="text-xs text-blue-600 mt-1">Next: {eng.nextAction}</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No engagements logged yet</p>
                  )}
                </div>
              </>
            ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
