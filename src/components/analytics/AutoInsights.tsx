'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Star, TrendingUp, ChevronDown } from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { describeHighlight, type CrossTab } from '@/lib/cross-reference'

/**
 * Auto-insights: the significance-tested theme × segment patterns, rendered
 * as report-ready statements plus an explorable heatmap (themes × channel and
 * early/late period). Cells are coloured by lift and starred only when the
 * server-side test (two-proportion z, Benjamini-Hochberg corrected) passed —
 * the display recomputes shares for colour, but significance is never
 * invented client-side.
 */

interface ExplorerItem {
  id: string
  type: 'pin' | 'form' | 'enquiry'
  createdAt: string
}

interface ExplorerAssignment {
  id: string
  themeIds: number[]
}

interface WorkspacePayload {
  analysis: {
    taxonomy?: Array<{ name: string }>
    assignments?: ExplorerAssignment[]
    crossReference?: {
      highlights: CrossTab[]
      tested: number
      significant: number
    }
  } | null
  items: ExplorerItem[]
}

interface Column {
  key: string
  label: string
  dimension: CrossTab['dimension']
  /** Segment label as the server names it, for matching highlights. */
  segmentLabel: string
  ids: Set<string>
}

const SOURCE_COLUMNS: Array<{ type: ExplorerItem['type']; label: string; segmentLabel: string }> = [
  { type: 'pin', label: 'Map pins', segmentLabel: 'map pins' },
  { type: 'form', label: 'Forms', segmentLabel: 'form responses' },
  { type: 'enquiry', label: 'Enquiries', segmentLabel: 'enquiries' },
]

const MAX_ROWS = 10
const STATEMENTS_COLLAPSED = 4

export function AutoInsights({
  projectId,
  onViewTheme,
}: {
  projectId: string
  onViewTheme: (themeName: string) => void
}) {
  const [showAll, setShowAll] = useState(false)

  const { data } = useQuery<WorkspacePayload>({
    queryKey: ['analytics-workspace', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/analytics/workspace`),
    staleTime: 60_000,
  })

  const items = useMemo(() => data?.items ?? [], [data])
  const taxonomy = data?.analysis?.taxonomy ?? []
  const assignments = useMemo(() => data?.analysis?.assignments ?? [], [data])
  const highlights = useMemo(
    () => data?.analysis?.crossReference?.highlights ?? [],
    [data]
  )

  const model = useMemo(() => {
    if (items.length === 0 || taxonomy.length === 0 || assignments.length === 0) return null

    const itemById = new Map(items.map(item => [item.id, item]))
    const classified = assignments.filter(a => itemById.has(a.id))
    if (classified.length < 10) return null

    // Columns: the three channels, plus the median-split periods — the same
    // segmentation the server tested, rebuilt for display.
    const columns: Column[] = []
    SOURCE_COLUMNS.forEach(source => {
      const ids = new Set(
        classified.filter(a => itemById.get(a.id)!.type === source.type).map(a => a.id)
      )
      if (ids.size > 0) {
        columns.push({
          key: `source-${source.type}`,
          label: source.label,
          dimension: 'source',
          segmentLabel: source.segmentLabel,
          ids,
        })
      }
    })

    const times = classified
      .map(a => new Date(itemById.get(a.id)!.createdAt).getTime())
      .sort((a, b) => a - b)
    const median = times[Math.floor(times.length / 2)]
    const earlyIds = new Set<string>()
    const lateIds = new Set<string>()
    classified.forEach(a => {
      const at = new Date(itemById.get(a.id)!.createdAt).getTime()
      if (at < median) earlyIds.add(a.id)
      else lateIds.add(a.id)
    })
    if (earlyIds.size > 0 && lateIds.size > 0) {
      columns.push({ key: 'period-early', label: 'Earlier', dimension: 'period', segmentLabel: 'earlier responses', ids: earlyIds })
      columns.push({ key: 'period-late', label: 'Later', dimension: 'period', segmentLabel: 'later responses', ids: lateIds })
    }

    if (columns.length < 2) return null

    const idsByTheme = taxonomy.map((_, themeIndex) => {
      const ids = new Set<string>()
      classified.forEach(a => {
        if (a.themeIds.includes(themeIndex)) ids.add(a.id)
      })
      return ids
    })

    const rows = taxonomy
      .map((theme, index) => ({ name: theme.name, index, total: idsByTheme[index].size }))
      .filter(row => row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_ROWS)

    const total = classified.length

    const significantFor = (themeName: string, column: Column) =>
      highlights.find(
        h => h.theme === themeName && h.dimension === column.dimension && h.segment === column.segmentLabel
      )

    const cells = rows.map(row =>
      columns.map(column => {
        const themeIds = idsByTheme[row.index]
        let count = 0
        column.ids.forEach(id => {
          if (themeIds.has(id)) count++
        })
        const segmentTotal = column.ids.size
        const outsideTotal = total - segmentTotal
        const outsideCount = row.total - count
        const share = segmentTotal > 0 ? count / segmentTotal : 0
        const baseline = outsideTotal > 0 ? outsideCount / outsideTotal : 0
        const lift = baseline > 0 ? share / baseline : count > 0 ? Infinity : 1
        return { count, segmentTotal, share, baseline, lift, significant: significantFor(row.name, column) }
      })
    )

    return { columns, rows, cells, total }
  }, [items, taxonomy, assignments, highlights])

  if (!model && highlights.length === 0) return null

  const statements = showAll ? highlights : highlights.slice(0, STATEMENTS_COLLAPSED)

  return (
    <div className="card p-6">
      <div className="mb-5">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-600" />
          Auto-insights
        </h3>
        <p className="text-sm text-slate-500">
          Patterns tested for statistical significance across every classified response — counted, not sampled.
        </p>
      </div>

      {/* Report-ready statements */}
      {highlights.length > 0 && (
        <div className="space-y-2 mb-6">
          {statements.map((tab, index) => {
            const exclusive = tab.baselineShare === 0
            const up = tab.lift >= 1
            const liftLabel = exclusive
              ? 'only here'
              : `${up ? '+' : '−'}${Math.abs(Math.round((tab.lift - 1) * 100))}%`
            return (
              <div key={index} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0 tabular-nums ${
                    up || exclusive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {liftLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{describeHighlight(tab)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    p {tab.pValue < 0.001 ? '< 0.001' : `= ${tab.pValue.toFixed(3)}`} · significant after correction
                  </p>
                </div>
                <button
                  onClick={() => onViewTheme(tab.theme)}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0 mt-1"
                >
                  View responses
                </button>
              </div>
            )
          })}
          {highlights.length > STATEMENTS_COLLAPSED && (
            <button
              onClick={() => setShowAll(current => !current)}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              {showAll ? 'Show fewer' : `Show all ${highlights.length}`}
              <ChevronDown size={14} className={`transition-transform ${showAll ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      )}

      {highlights.length === 0 && (
        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg px-4 py-3 mb-6">
          No statistically significant patterns yet — differences between channels and periods are within what
          chance would produce at this volume. The matrix below shows the raw distribution.
        </p>
      )}

      {/* Heatmap: themes × channel/period */}
      {model && (
        <div className="overflow-x-auto">
          <table className="border-separate" style={{ borderSpacing: '3px' }}>
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-slate-400 pr-3 pb-1 font-normal">Theme</th>
                {model.columns.map(column => (
                  <th key={column.key} className="text-xs font-medium text-slate-500 pb-1 px-1 min-w-[52px]">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row, rowIndex) => (
                <tr key={row.name}>
                  <td className="pr-3">
                    <button
                      onClick={() => onViewTheme(row.name)}
                      className="text-sm text-slate-700 hover:text-brand-700 whitespace-nowrap"
                      title="View responses raising this theme"
                    >
                      {row.name} <span className="text-slate-400 tabular-nums">({row.total})</span>
                    </button>
                  </td>
                  {model.cells[rowIndex].map((cell, colIndex) => {
                    const column = model.columns[colIndex]
                    // Colour encodes direction and strength of the departure
                    // from baseline; the star alone encodes significance.
                    let background = '#F8FAFC'
                    if (cell.count > 0) {
                      const up = cell.lift >= 1
                      const magnitude =
                        cell.lift === Infinity
                          ? 1
                          : Math.min(Math.abs(Math.log2(Math.max(cell.lift, 0.01))) / 2, 1)
                      const alpha = 0.1 + magnitude * (cell.significant ? 0.55 : 0.35)
                      background = up
                        ? `rgba(16, 185, 129, ${alpha.toFixed(2)})`
                        : `rgba(239, 68, 68, ${alpha.toFixed(2)})`
                    }
                    const statement = cell.significant
                      ? describeHighlight(cell.significant)
                      : `“${row.name}” appears in ${Math.round(cell.share * 100)}% of ${column.segmentLabel} (${cell.count} of ${cell.segmentTotal}) vs ${Math.round(cell.baseline * 100)}% elsewhere. Not statistically significant.`
                    return (
                      <td key={column.key} className="relative group p-0">
                        <div
                          className="w-11 h-8 rounded-md flex items-center justify-center cursor-default"
                          style={{ backgroundColor: background }}
                        >
                          {cell.significant && <Star size={11} className="text-white fill-white drop-shadow-sm" />}
                        </div>
                        {/* Hover tooltip with the counted statement */}
                        <div className="hidden group-hover:block absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-64 bg-slate-900 text-white rounded-lg p-3 shadow-xl">
                          <p className="text-xs leading-relaxed">{statement}</p>
                          <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                            {cell.count} instance{cell.count === 1 ? '' : 's'} of this combination
                          </p>
                          <button
                            onClick={() => onViewTheme(row.name)}
                            className="mt-2 text-[11px] font-medium bg-white/10 hover:bg-white/20 rounded-md px-2 py-1 transition-colors"
                          >
                            View responses
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
            <Star size={10} className="text-slate-400 fill-slate-400" />
            = statistically significant (p ≤ 0.05, corrected for multiple comparisons). Colour shows direction and
            strength vs the rest of the responses.
          </p>
        </div>
      )}
    </div>
  )
}
