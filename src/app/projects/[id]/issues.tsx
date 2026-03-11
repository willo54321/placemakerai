'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Volume2,
  Wind,
  Car,
  Home,
  ShieldAlert,
  Clock,
  MoreHorizontal,
  CheckCircle,
  Trash2,
  Pentagon,
  Minus,
  ExternalLink,
  Copy,
  Check,
  Code,
} from 'lucide-react'

// Issue category configuration
const ISSUE_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  noise: { label: 'Noise', color: '#dc2626', bg: '#fef2f2', icon: Volume2 },
  dust: { label: 'Dust/Pollution', color: '#ea580c', bg: '#fff7ed', icon: Wind },
  traffic: { label: 'Traffic/Access', color: '#ca8a04', bg: '#fefce8', icon: Car },
  damage: { label: 'Property Damage', color: '#7c3aed', bg: '#f5f3ff', icon: Home },
  safety: { label: 'Safety Concern', color: '#dc2626', bg: '#fef2f2', icon: ShieldAlert },
  hours: { label: 'Working Hours', color: '#2563eb', bg: '#eff6ff', icon: Clock },
  other: { label: 'Other', color: '#6b7280', bg: '#f9fafb', icon: MoreHorizontal },
}

interface PublicPin {
  id: string
  latitude: number | null
  longitude: number | null
  category: string
  comment: string
  name: string | null
  email: string | null
  createdAt: string
  votes: number
  approved: boolean
  geometry: any
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
  publicPins: PublicPin[]
}

export function IssuesTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)
  const [resolvingPinId, setResolvingPinId] = useState<string | null>(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  const deletePin = useMutation({
    mutationFn: async (pinId: string) => {
      await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'DELETE'
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    }
  })

  const approvePin = useMutation({
    mutationFn: async ({ pinId, approved }: { pinId: string; approved: boolean }) => {
      setPendingApprovalId(pinId)
      const response = await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved })
      })
      if (!response.ok) throw new Error(`Failed to update pin: ${response.status}`)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
    onSettled: () => {
      setPendingApprovalId(null)
    }
  })

  const resolveIssue = useMutation({
    mutationFn: async ({ pinId, resolved, resolvedNotes }: { pinId: string; resolved: boolean; resolvedNotes?: string }) => {
      const response = await fetch(`/api/projects/${projectId}/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved, resolvedNotes })
      })
      if (!response.ok) throw new Error(`Failed to resolve issue: ${response.status}`)
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setResolvingPinId(null)
      setResolveNotes('')
    }
  })

  // Filter to only show issues
  const issues = (project.publicPins || []).filter(pin => pin.mode === 'issues')

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

  return (
    <div className="p-6 space-y-6">
      {/* Header with embed code */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Construction Issue Reporter</h2>
              <p className="text-sm text-gray-600">
                {project.issuesEnabled
                  ? 'Residents can report construction-related issues'
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
            <pre className="mt-2 bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto">
              <code>{embedCode}</code>
            </pre>
          </details>
        )}
      </div>

      {/* Stats */}
      {issues.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(ISSUE_CATEGORY_CONFIG).map(([key, config]) => {
            const count = categoryStats[key] || 0
            if (count === 0) return null
            const IconComponent = config.icon
            return (
              <div key={key} className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: config.bg }}
                  >
                    <IconComponent size={20} style={{ color: config.color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                    <p className="text-sm text-gray-500">{config.label}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Issues list */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Reported Issues ({issues.length})</h3>
          <div className="flex gap-2 text-sm">
            <span className="text-gray-500">
              {issues.filter(i => !i.resolved).length} open
            </span>
            <span className="text-green-600">
              {issues.filter(i => i.resolved).length} resolved
            </span>
          </div>
        </div>

        {!issues.length ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={28} className="text-orange-400" />
            </div>
            <p className="text-gray-500">No construction issues reported</p>
            <p className="text-sm text-gray-400 mt-1">
              {project.issuesEnabled && project.embedEnabled
                ? 'Share the embed code to start collecting issue reports'
                : 'Enable issue reporting in Website settings first'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {issues.map(pin => {
              const config = ISSUE_CATEGORY_CONFIG[pin.category] || ISSUE_CATEGORY_CONFIG.other
              const IconComponent = config.icon
              return (
                <div key={pin.id} className={`px-6 py-4 hover:bg-gray-50 ${pin.resolved ? 'bg-green-50/50' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: config.bg }}
                    >
                      <IconComponent size={20} style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: config.bg, color: config.color }}
                        >
                          {config.label}
                        </span>
                        {pin.resolved ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Resolved
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Clock size={12} />
                            Open
                          </span>
                        )}
                        {pin.name && (
                          <span className="text-sm font-medium text-gray-700">{pin.name}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {new Date(pin.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{pin.comment}</p>
                      {pin.resolvedNotes && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-700 mb-1">Resolution Notes:</p>
                          <p className="text-sm text-green-800">{pin.resolvedNotes}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {pin.shapeType === 'pin' || !pin.shapeType ? (
                          <span>{pin.latitude?.toFixed(6)}, {pin.longitude?.toFixed(6)}</span>
                        ) : (
                          <span>
                            {pin.shapeType === 'line' ? 'Route' : 'Area'} marked
                          </span>
                        )}
                        {pin.email && (
                          <a href={`mailto:${pin.email}`} className="text-orange-600 hover:underline">
                            {pin.email}
                          </a>
                        )}
                      </div>

                      {/* Resolve form */}
                      {resolvingPinId === pin.id && (
                        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Notes (optional)</label>
                          <textarea
                            value={resolveNotes}
                            onChange={(e) => setResolveNotes(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            rows={2}
                            placeholder="Describe how the issue was resolved..."
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => resolveIssue.mutate({ pinId: pin.id, resolved: true, resolvedNotes: resolveNotes })}
                              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                              Mark Resolved
                            </button>
                            <button
                              onClick={() => { setResolvingPinId(null); setResolveNotes('') }}
                              className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
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
                          onClick={() => resolveIssue.mutate({ pinId: pin.id, resolved: false })}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg"
                          title="Reopen issue"
                        >
                          <Clock size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this issue report?')) {
                            deletePin.mutate(pin.id)
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
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
