'use client'

import { useQuery } from '@tanstack/react-query'

// Shared per-plot comparison cards, used by both the Programme tab and the AI
// Analytics tab so there is a single source of truth for the plot rollup.

export type Plot = {
  key: string
  name: string
  color: string
  pins: number
  support: number
  neutral: number
  object: number
  surveyResponses: number
  theme: string | null
  headline: string | null
}

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

/** Presentational grid of per-plot cards. */
export function PlotComparisonCards({ plots }: { plots: Plot[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {plots.map(p => {
        const participationCount = p.pins + p.surveyResponses
        return (
          <div key={p.key} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: p.color }} />
              <h3 className="font-semibold text-slate-900">{p.name}</h3>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-slate-900">{participationCount}</span>
              <span className="text-sm text-slate-500">contributions</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{p.pins} map comments · {p.surveyResponses} survey responses</div>
            <div className="mt-4">
              <StanceBar support={p.support} neutral={p.neutral} object={p.object} />
              <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                <span>{p.support} support</span>
                <span>{p.neutral} neutral</span>
                <span>{p.object} object</span>
              </div>
            </div>
            {p.theme && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Leading theme</div>
                <div className="mt-0.5 text-sm font-medium text-slate-700">{p.theme}</div>
                {p.headline && <p className="mt-1 text-xs leading-relaxed text-slate-500">{p.headline}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Self-fetching wrapper for the AI Analytics tab. Renders nothing for single-
 * site projects, so the section only appears where a plot breakdown is
 * meaningful. Shares the ['programme', projectId] query cache with the
 * Programme tab.
 */
export function PlotComparison({ projectId }: { projectId: string }) {
  const { data } = useQuery<{ plots: Plot[] }>({
    queryKey: ['programme', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/programme`)
      if (!res.ok) throw new Error('Failed to load programme data')
      return res.json()
    },
  })

  const plots = data?.plots ?? []
  if (plots.length < 2) return null

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">How the {plots.length} plots compare</h3>
      <p className="text-sm text-slate-500 mt-0.5 mb-4">
        The same feedback, broken down by plot — where support and objection concentrate across the programme.
      </p>
      <PlotComparisonCards plots={plots} />
    </div>
  )
}
