'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'

interface ExplorerItem {
  id: string
  type: 'pin' | 'form' | 'enquiry'
  content: string
  createdAt: string
}

interface ExplorerAssignment {
  id: string
  sentiment: 'positive' | 'negative' | 'neutral'
  themeIds: number[]
}

interface WorkspacePayload {
  analysis: {
    taxonomy?: Array<{ name: string }>
    assignments?: ExplorerAssignment[]
  } | null
  items: ExplorerItem[]
}

const SOURCE_LABELS: Record<ExplorerItem['type'], string> = {
  pin: 'Map pin',
  form: 'Form',
  enquiry: 'Enquiry',
}

const STANCE_DOT: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#94a3b8',
}

const PAGE_SIZE = 20

/**
 * Every response, filterable by theme — themes come from the analysis
 * taxonomy and membership from the per-response assignments, so the counts
 * here match the charts above exactly.
 */
export function ResponsesExplorer({ projectId }: { projectId: string }) {
  const [themeFilter, setThemeFilter] = useState<number | null>(null)
  const [limit, setLimit] = useState(PAGE_SIZE)

  const { data } = useQuery<WorkspacePayload>({
    queryKey: ['analytics-workspace', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/analytics/workspace`),
    staleTime: 60_000,
  })

  const items = useMemo(() => data?.items ?? [], [data])
  const taxonomy = data?.analysis?.taxonomy ?? []
  const assignments = useMemo(() => data?.analysis?.assignments ?? [], [data])

  const assignmentById = useMemo(
    () => new Map(assignments.map(a => [a.id, a])),
    [assignments]
  )

  const themeChips = useMemo(
    () =>
      taxonomy
        .map((theme, index) => ({
          index,
          name: theme.name,
          count: assignments.filter(a => a.themeIds.includes(index)).length,
        }))
        .filter(chip => chip.count > 0)
        .sort((a, b) => b.count - a.count),
    [taxonomy, assignments]
  )

  const filtered = useMemo(() => {
    const sorted = [...items].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    if (themeFilter == null) return sorted
    return sorted.filter(item =>
      (assignmentById.get(item.id)?.themeIds ?? []).includes(themeFilter)
    )
  }, [items, themeFilter, assignmentById])

  if (items.length === 0) return null

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <MessageSquare size={18} className="text-brand-600" />
          Responses
        </h3>
        <p className="text-sm text-slate-500">
          {themeFilter == null
            ? `All ${items.length.toLocaleString()} responses`
            : `${filtered.length.toLocaleString()} responses raising “${taxonomy[themeFilter]?.name}”`}
        </p>
      </div>

      {themeChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => {
              setThemeFilter(null)
              setLimit(PAGE_SIZE)
            }}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              themeFilter == null
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All themes
          </button>
          {themeChips.map(chip => (
            <button
              key={chip.index}
              onClick={() => {
                setThemeFilter(themeFilter === chip.index ? null : chip.index)
                setLimit(PAGE_SIZE)
              }}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                themeFilter === chip.index
                  ? 'bg-brand-600 border-brand-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {chip.name}
              <span className={themeFilter === chip.index ? 'text-brand-100 ml-1.5' : 'text-slate-400 ml-1.5'}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {filtered.slice(0, limit).map(item => {
          const assignment = assignmentById.get(item.id)
          return (
            <div key={item.id} className="py-3 flex items-start gap-3">
              <span
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: STANCE_DOT[assignment?.sentiment ?? 'neutral'] }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {SOURCE_LABELS[item.type]}
                  </span>
                  {(assignment?.themeIds ?? []).map(themeId => (
                    <span
                      key={themeId}
                      className="text-[11px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-500"
                    >
                      {taxonomy[themeId]?.name}
                    </span>
                  ))}
                  <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                    {new Date(item.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{item.content}</p>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length > limit && (
        <button
          onClick={() => setLimit(current => current + PAGE_SIZE * 2)}
          className="w-full pt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          View more ({(filtered.length - limit).toLocaleString()} more)
        </button>
      )}
      {filtered.length === 0 && (
        <p className="text-sm text-slate-400 py-4">No responses raise this theme.</p>
      )}
    </div>
  )
}
