'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  MessageCircle,
  CheckCircle,
  Clock,
  Trash2,
  Pentagon,
  Minus,
} from 'lucide-react'

// Feedback category configuration
const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  positive: { label: 'Positive', color: '#16a34a', bg: '#f0fdf4', icon: ThumbsUp },
  negative: { label: 'Concern', color: '#dc2626', bg: '#fef2f2', icon: ThumbsDown },
  question: { label: 'Question', color: '#2563eb', bg: '#eff6ff', icon: HelpCircle },
  comment: { label: 'Comment', color: '#6b7280', bg: '#f9fafb', icon: MessageCircle },
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
}

interface Project {
  id: string
  name: string
  embedEnabled: boolean
  publicPins: PublicPin[]
}

export function FeedbackPinsTab({ projectId, project }: { projectId: string; project: Project }) {
  const queryClient = useQueryClient()
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null)

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

  // Filter to only show feedback pins (not issues)
  const feedbackPins = (project.publicPins || []).filter(pin =>
    (pin.mode || 'feedback') === 'feedback'
  )

  const categoryStats = feedbackPins.reduce((acc, pin) => {
    acc[pin.category] = (acc[pin.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      {/* Stats */}
      {feedbackPins.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
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

      {/* Pins list */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Map Feedback ({feedbackPins.length})</h3>
          <div className="flex gap-2 text-sm">
            <span className="text-amber-600">
              {feedbackPins.filter(p => !p.approved).length} pending
            </span>
            <span className="text-green-600">
              {feedbackPins.filter(p => p.approved).length} approved
            </span>
          </div>
        </div>

        {!feedbackPins.length ? (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={28} className="text-gray-400" />
            </div>
            <p className="text-gray-500">No map feedback yet</p>
            <p className="text-sm text-gray-400 mt-1">
              {project.embedEnabled
                ? 'Share the embed code to start collecting feedback'
                : 'Enable embedding in Website settings first'}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {feedbackPins.map(pin => {
              const config = CATEGORY_CONFIG[pin.category] || CATEGORY_CONFIG.comment
              const IconComponent = config.icon
              return (
                <div key={pin.id} className={`px-6 py-4 hover:bg-gray-50 ${!pin.approved ? 'bg-amber-50/50' : ''}`}>
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
                        {pin.approved ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle size={12} />
                            Approved
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                            <Clock size={12} />
                            Pending
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
                        {pin.shapeType && pin.shapeType !== 'pin' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                            {pin.shapeType === 'line' ? <Minus size={12} /> : <Pentagon size={12} />}
                            {pin.shapeType === 'line' ? 'Route' : 'Area'}
                          </span>
                        )}
                        {pin.votes > 0 && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <ThumbsUp size={12} />
                            {pin.votes}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{pin.comment}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        {pin.shapeType === 'pin' || !pin.shapeType ? (
                          <span>{pin.latitude?.toFixed(6)}, {pin.longitude?.toFixed(6)}</span>
                        ) : (
                          <span>
                            {pin.shapeType === 'line' ? 'Route' : 'Area'} marked
                          </span>
                        )}
                        {pin.email && (
                          <a href={`mailto:${pin.email}`} className="text-green-600 hover:underline">
                            {pin.email}
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      {!pin.approved ? (
                        <button
                          onClick={() => approvePin.mutate({ pinId: pin.id, approved: true })}
                          disabled={pendingApprovalId === pin.id}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                          title="Approve"
                        >
                          <CheckCircle size={18} />
                        </button>
                      ) : (
                        <button
                          onClick={() => approvePin.mutate({ pinId: pin.id, approved: false })}
                          disabled={pendingApprovalId === pin.id}
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg disabled:opacity-50"
                          title="Unapprove"
                        >
                          <Clock size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this feedback?')) {
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
