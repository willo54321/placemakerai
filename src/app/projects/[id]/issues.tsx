'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  HardHat,
  Volume2,
  Wind,
  Car,
  Home,
  ShieldAlert,
  Clock,
  MoreHorizontal,
  CheckCircle,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Code,
  ThumbsUp,
} from 'lucide-react'
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from '@/lib/issues'

// Icons/colors are presentation-only; labels come from lib/issues so the
// vocabulary matches the embed and the notification emails.
const CATEGORY_STYLE: Record<IssueCategory, { color: string; bg: string; icon: React.ElementType }> = {
  noise: { color: '#dc2626', bg: '#fef2f2', icon: Volume2 },
  dust: { color: '#ea580c', bg: '#fff7ed', icon: Wind },
  traffic: { color: '#ca8a04', bg: '#fefce8', icon: Car },
  damage: { color: '#7c3aed', bg: '#f5f3ff', icon: Home },
  safety: { color: '#dc2626', bg: '#fef2f2', icon: ShieldAlert },
  hours: { color: '#2563eb', bg: '#eff6ff', icon: Clock },
  other: { color: '#6b7280', bg: '#f9fafb', icon: MoreHorizontal },
}

function categoryStyle(category: string) {
  return CATEGORY_STYLE[category as IssueCategory] || CATEGORY_STYLE.other
}

function categoryLabel(category: string) {
  return ISSUE_CATEGORY_LABELS[category as IssueCategory] || ISSUE_CATEGORY_LABELS.other
}

interface IssuePin {
  id: string
  latitude: number | null
  longitude: number | null
  category: string
  comment: string
  name: string | null
  email: string | null
  photoUrl: string | null
  createdAt: string
  votes: number
  approved: boolean
  geometry: unknown
  shapeType: string
  mode: string
  resolved: boolean
  resolvedAt: string | null
  resolvedNotes: string | null
}

interface Project {
  id: string
  name: string
  embedEnabled: boolean
  issuesEnabled: boolean
  publicPins: IssuePin[]
}

type Filter = 'all' | 'open' | 'resolved'

export function IssuesTab({ projectId, project, isAdmin }: { projectId: string; project: Project; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [resolvingPinId, setResolvingPinId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  const updatePin = useMutation({
    mutationFn: async ({ pinId, ...data }: { pinId: string; approved?: boolean; resolved?: boolean; resolvedNotes?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error(`Failed to update issue: ${response.status}`)
      return response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      if (typeof variables.resolved === 'boolean') {
        setResolvingPinId(null)
        setResolveNotes('')
        toast.success(variables.resolved ? 'Issue marked resolved' : 'Issue reopened')
      } else if (typeof variables.approved === 'boolean') {
        toast.success(variables.approved ? 'Published — now visible on the public issue map' : 'Unpublished — hidden from the public issue map')
      }
    },
    onError: () => {
      toast.error('Failed to update — no change was made')
    },
  })

  const deletePin = useMutation({
    mutationFn: async (pinId: string) => {
      const response = await fetch(`/api/projects/${projectId}/pins/${pinId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(`Failed to delete: ${response.status}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Issue report permanently deleted')
    },
    onError: () => {
      toast.error('Failed to delete — the report is unchanged')
    },
  })

  const issues = (project.publicPins || []).filter(pin => pin.mode === 'issues')
  const openCount = issues.filter(i => !i.resolved).length
  const resolvedCount = issues.length - openCount

  const visibleIssues = issues.filter(pin =>
    filter === 'all' ? true : filter === 'open' ? !pin.resolved : pin.resolved
  )

  const categoryStats = issues.reduce((acc, pin) => {
    acc[pin.category] = (acc[pin.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const embedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}/issues`
    : `/embed/${projectId}/issues`

  const embedCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  allow="geolocation"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>`

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const confirmDelete = (pin: IssuePin) => {
    const preview = pin.comment.length > 120 ? `${pin.comment.slice(0, 120)}…` : pin.comment
    if (confirm(`Permanently delete this issue report${pin.name ? ` from "${pin.name}"` : ''}?\n\n"${preview}"\n\nThis cannot be undone.`)) {
      deletePin.mutate(pin.id)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with embed code */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <HardHat size={20} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Construction Issue Reporter</h2>
              <p className="text-sm text-slate-600">
                {project.issuesEnabled && project.embedEnabled
                  ? 'Residents can report issues, with photos, on the public map'
                  : 'Enable issue reporting in Website settings'}
              </p>
            </div>
          </div>
          {project.issuesEnabled && project.embedEnabled && (
            <div className="flex gap-2">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 px-3 py-1.5 bg-white rounded-lg border border-orange-200"
              >
                <ExternalLink size={14} /> Preview
              </a>
              <button
                onClick={copyEmbedCode}
                className="flex items-center gap-1 text-sm text-orange-600 hover:text-orange-700 px-3 py-1.5 bg-white rounded-lg border border-orange-200"
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                {copiedCode ? 'Copied!' : 'Copy Embed'}
              </button>
            </div>
          )}
        </div>
        {project.issuesEnabled && project.embedEnabled && (
          <details className="mt-4">
            <summary className="text-sm text-orange-700 cursor-pointer hover:underline flex items-center gap-1">
              <Code size={14} /> Show embed code
            </summary>
            <pre className="mt-2 bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
          </details>
        )}
      </div>

      {/* Category stats */}
      {issues.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.keys(ISSUE_CATEGORY_LABELS).map(key => {
            const count = categoryStats[key] || 0
            if (count === 0) return null
            const style = categoryStyle(key)
            const IconComponent = style.icon
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: style.bg }}>
                    <IconComponent size={20} style={{ color: style.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{count}</p>
                    <p className="text-sm text-slate-500">{categoryLabel(key)}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Issues list */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold">Reported Issues ({issues.length})</h3>
          <div className="flex gap-1">
            {([
              ['all', `All (${issues.length})`],
              ['open', `Open (${openCount})`],
              ['resolved', `Resolved (${resolvedCount})`],
            ] as [Filter, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  filter === value ? 'bg-orange-100 text-orange-700 font-medium' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!visibleIssues.length ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HardHat size={28} className="text-orange-400" />
            </div>
            <p className="text-slate-500">
              {issues.length === 0 ? 'No construction issues reported' : 'No issues match this filter'}
            </p>
            {issues.length === 0 && (
              <p className="text-sm text-slate-400 mt-1">
                {project.issuesEnabled && project.embedEnabled
                  ? 'Share the embed code to start collecting issue reports'
                  : 'Enable issue reporting in Website settings first'}
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y">
            {visibleIssues.map(pin => {
              const style = categoryStyle(pin.category)
              const IconComponent = style.icon
              return (
                <div key={pin.id} className={`px-6 py-4 hover:bg-slate-50 ${pin.resolved ? 'bg-green-50/50' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: style.bg }}>
                      <IconComponent size={20} style={{ color: style.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: style.bg, color: style.color }}>
                          {categoryLabel(pin.category)}
                        </span>
                        {pin.resolved ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle size={12} /> Resolved
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Clock size={12} /> Open
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          pin.approved ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {pin.approved ? <Eye size={12} /> : <EyeOff size={12} />}
                          {pin.approved ? 'Published' : 'Not published'}
                        </span>
                        {pin.votes > 0 && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                            <ThumbsUp size={12} /> {pin.votes} affected
                          </span>
                        )}
                        {pin.name && <span className="text-sm font-medium text-slate-700">{pin.name}</span>}
                        <span className="text-xs text-slate-400">
                          {new Date(pin.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{pin.comment}</p>
                      {pin.photoUrl && (
                        <a href={pin.photoUrl} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pin.photoUrl}
                            alt="Photo attached to this issue report"
                            className="h-24 rounded-lg border border-slate-200 object-cover hover:opacity-90"
                          />
                        </a>
                      )}
                      {pin.resolvedNotes && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-700 mb-1">Resolution notes</p>
                          <p className="text-sm text-green-800 whitespace-pre-wrap">{pin.resolvedNotes}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                        {pin.shapeType === 'pin' || !pin.shapeType ? (
                          <span>{pin.latitude?.toFixed(6)}, {pin.longitude?.toFixed(6)}</span>
                        ) : (
                          <span>{pin.shapeType === 'line' ? 'Route' : 'Area'} marked</span>
                        )}
                        {pin.email && (
                          <a href={`mailto:${pin.email}`} className="text-orange-600 hover:underline">{pin.email}</a>
                        )}
                      </div>

                      {/* Resolve form */}
                      {isAdmin && resolvingPinId === pin.id && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <label className="block text-sm font-medium text-slate-700 mb-2">Resolution notes (optional)</label>
                          <textarea
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                            rows={2}
                            placeholder="Describe what was done — shown publicly under the resolved issue"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updatePin.mutate({ pinId: pin.id, resolved: true, resolvedNotes: resolveNotes })}
                              disabled={updatePin.isPending}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                              Mark Resolved
                            </button>
                            <button
                              onClick={() => { setResolvingPinId(null); setResolveNotes('') }}
                              className="px-3 py-1.5 text-slate-600 text-sm hover:bg-slate-100 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isAdmin && (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => updatePin.mutate({ pinId: pin.id, approved: !pin.approved })}
                          disabled={updatePin.isPending}
                          className={`p-2 rounded-lg ${pin.approved ? 'text-slate-500 hover:bg-slate-100' : 'text-blue-600 hover:bg-blue-50'}`}
                          title={pin.approved ? 'Unpublish from the public issue map' : 'Publish to the public issue map'}
                        >
                          {pin.approved ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                        {!pin.resolved && resolvingPinId !== pin.id && (
                          <button
                            onClick={() => setResolvingPinId(pin.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Resolve issue"
                          >
                            <CheckCircle size={18} />
                          </button>
                        )}
                        {pin.resolved && (
                          <button
                            onClick={() => updatePin.mutate({ pinId: pin.id, resolved: false })}
                            disabled={updatePin.isPending}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                            title="Reopen issue"
                          >
                            <Clock size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => confirmDelete(pin)}
                          disabled={deletePin.isPending}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
