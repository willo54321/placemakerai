'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

export const STANCE_COLORS = { support: '#16A34A', neutral: '#94A3B8', object: '#DC2626' }

export function StanceBar({ support, neutral, object }: { support: number; neutral: number; object: number }) {
  const total = support + neutral + object || 1
  const seg = (n: number, c: string) => (n > 0 ? <div style={{ width: `${(n / total) * 100}%`, background: c }} className="h-full" /> : null)
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      {seg(support, STANCE_COLORS.support)}
      {seg(neutral, STANCE_COLORS.neutral)}
      {seg(object, STANCE_COLORS.object)}
    </div>
  )
}

export type Segment = {
  key: string
  label: string
  color: string
  total: number
  support: number
  neutral: number
  object: number
  sublabel?: string
  theme?: string | null
  headline?: string | null
}

export type Breakdown = { key: string; label: string; segments: Segment[] }

function SegmentCards({ segments }: { segments: Segment[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {segments.map(s => (
        <div key={s.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: s.color }} />
            <h4 className="font-semibold text-slate-900">{s.label}</h4>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900">{s.total}</span>
            <span className="text-sm text-slate-500">responses</span>
          </div>
          {s.sublabel && <div className="mt-1 text-xs text-slate-400">{s.sublabel}</div>}
          <div className="mt-4">
            <StanceBar support={s.support} neutral={s.neutral} object={s.object} />
            <div className="mt-1.5 flex justify-between text-xs text-slate-500">
              <span>{s.support} support</span>
              <span>{s.neutral} neutral</span>
              <span>{s.object} object</span>
            </div>
          </div>
          {s.theme && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Leading theme</div>
              <div className="mt-0.5 text-sm font-medium text-slate-700">{s.theme}</div>
              {s.headline && <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.headline}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Breakdown of all feedback, sliced by a chosen dimension (zone or source).
// Dimensions with fewer than two segments are hidden.
export function FeedbackBreakdown({ projectId }: { projectId: string }) {
  const { data } = useQuery<{ breakdowns: Breakdown[] }>({
    queryKey: ['programme', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/programme`)
      if (!res.ok) throw new Error('Failed to load breakdown data')
      return res.json()
    },
  })

  const breakdowns = (data?.breakdowns ?? []).filter(b => b.segments.length >= 2)
  const [dim, setDim] = useState<string | null>(null)
  if (breakdowns.length === 0) return null
  const active = breakdowns.find(b => b.key === dim) ?? breakdowns[0]

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Feedback breakdown</h3>
        {breakdowns.length > 1 && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {breakdowns.map(b => (
              <button
                key={b.key}
                onClick={() => setDim(b.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  active.key === b.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <SegmentCards segments={active.segments} />
    </div>
  )
}
