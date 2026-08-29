'use client'

import { useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, CheckCircle2, ChevronRight, MapPin, Megaphone,
  ScrollText, Search, Sparkles, X,
} from 'lucide-react'
import { fetchJson } from '@/lib/fetch-json'
import { Spinner } from '@/components/Spinner'
import { describeHighlight } from '@/lib/cross-reference'
import type { FullAnalysisResult, ItemAssignment, SpatialInsight } from '@/lib/ai'
import { STANCE_COLORS } from '@/components/AnalysisMap'

const AnalysisMap = dynamic(
  () => import('@/components/AnalysisMap').then(mod => mod.AnalysisMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-slate-100 animate-pulse flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading map...</p>
      </div>
    ),
  }
)

interface WorkspaceItem {
  id: string
  type: 'pin' | 'form' | 'enquiry'
  content: string
  latitude: number | null
  longitude: number | null
  createdAt: string
}

interface WorkspaceData {
  projectName: string
  boundary: unknown | null
  analysis: FullAnalysisResult | null
  processing: boolean
  lastAnalyzed: string | null
  items: WorkspaceItem[]
}

type Stance = 'positive' | 'negative' | 'neutral'

const SOURCE_LABELS: Record<WorkspaceItem['type'], string> = {
  pin: 'Map pin',
  form: 'Form',
  enquiry: 'Enquiry',
}

const STANCE_LABELS: Record<Stance, string> = {
  positive: 'Supports',
  negative: 'Objects',
  neutral: 'Neutral',
}

function StanceDot({ stance }: { stance: Stance | null }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: STANCE_COLORS[stance ?? 'neutral'] }}
    />
  )
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function formatP(p: number): string {
  if (p < 0.0001) return 'p < 0.0001'
  return `p = ${p.toPrecision(1)}`
}

export default function AnalysisWorkspacePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const projectId = params.id

  const [themeFilter, setThemeFilter] = useState<number | null>(null)
  const [stanceFilter, setStanceFilter] = useState<Stance | null>(null)
  const [sourceFilter, setSourceFilter] = useState<WorkspaceItem['type'] | null>(null)
  const [idFilter, setIdFilter] = useState<{ label: string; ids: string[] } | null>(null)
  const [search, setSearch] = useState('')
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<number | null>(null)
  const [detailTab, setDetailTab] = useState<'map' | 'response'>('map')
  const [listLimit, setListLimit] = useState(200)

  const { data, isLoading } = useQuery<WorkspaceData>({
    queryKey: ['analytics-workspace', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/analytics/workspace`),
  })

  const analysis = data?.analysis ?? null
  const items = useMemo(() => data?.items ?? [], [data])
  const taxonomy = useMemo(() => analysis?.taxonomy ?? [], [analysis])
  const assignments = useMemo(() => analysis?.assignments ?? [], [analysis])

  const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items])
  const assignmentById = useMemo(
    () => new Map<string, ItemAssignment>(assignments.map(a => [a.id, a])),
    [assignments]
  )

  // Theme counts + stance splits, tallied from the per-response assignments so
  // they respond to nothing but the data.
  const themeRows = useMemo(() => {
    return taxonomy
      .map((theme, index) => {
        const members = assignments.filter(a => a.themeIds.includes(index))
        const stances = { positive: 0, negative: 0, neutral: 0 }
        members.forEach(m => stances[m.sentiment]++)
        return { index, name: theme.name, count: members.length, stances }
      })
      .filter(row => row.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [taxonomy, assignments])

  // Campaign membership per response, for the badges and the response panel.
  const campaignByResponse = useMemo(() => {
    const map = new Map<string, { label: string; count: number; exact: boolean }>()
    analysis?.campaignAnalysis?.campaigns.forEach(campaign => {
      campaign.memberIds.forEach(id => {
        if (!map.has(id)) {
          map.set(id, { label: campaign.label, count: campaign.count, exact: campaign.exact })
        }
      })
    })
    return map
  }, [analysis])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter(item => {
      if (idFilter && !idFilter.ids.includes(item.id)) return false
      if (sourceFilter && item.type !== sourceFilter) return false
      const assignment = assignmentById.get(item.id)
      if (stanceFilter && assignment?.sentiment !== stanceFilter) return false
      if (themeFilter != null && !(assignment?.themeIds ?? []).includes(themeFilter)) return false
      if (query && !item.content.toLowerCase().includes(query)) return false
      return true
    })
  }, [items, idFilter, sourceFilter, stanceFilter, themeFilter, search, assignmentById])

  const mapResponses = useMemo(
    () =>
      filtered
        .filter(item => item.latitude != null && item.longitude != null)
        .map(item => ({
          id: item.id,
          latitude: item.latitude!,
          longitude: item.longitude!,
          sentiment: assignmentById.get(item.id)?.sentiment ?? null,
        })),
    [filtered, assignmentById]
  )

  const spatialInsights = useMemo(() => analysis?.spatialInsights ?? [], [analysis])

  const selectedResponse = selectedResponseId ? itemsById.get(selectedResponseId) : null
  const selectedAssignment = selectedResponseId ? assignmentById.get(selectedResponseId) : null

  // Non-area verified patterns; area findings appear as spatial insights with
  // proper place names instead of raw coordinates.
  const verifiedPatterns = useMemo(
    () => (analysis?.crossReference?.highlights ?? []).filter(h => h.dimension !== 'area'),
    [analysis]
  )

  const openResponse = (id: string) => {
    setSelectedResponseId(id)
    setDetailTab('response')
  }

  const showInsightOnMap = (index: number) => {
    setSelectedInsight(index)
    setDetailTab('map')
  }

  const filterToIds = (label: string, ids: string[]) => {
    setIdFilter({ label, ids })
    setThemeFilter(null)
    setStanceFilter(null)
    setSourceFilter(null)
    setSearch('')
  }

  const clearFilters = () => {
    setThemeFilter(null)
    setStanceFilter(null)
    setSourceFilter(null)
    setIdFilter(null)
    setSearch('')
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-cream-100 flex flex-col items-center justify-center gap-3 z-50">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading analysis workspace...</p>
      </div>
    )
  }

  if (!analysis || assignments.length === 0) {
    return (
      <div className="fixed inset-0 bg-cream-100 flex items-center justify-center z-50 p-6">
        <div className="card p-10 text-center max-w-md">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-brand-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            {data?.processing ? 'Analysis in progress' : 'No analysis available yet'}
          </h1>
          <p className="text-slate-500 text-sm mb-6">
            {data?.processing
              ? 'The workspace opens once the current run completes — usually a few minutes.'
              : analysis
                ? 'This analysis predates the workspace. Re-run the analysis from the AI Analytics tab to unlock per-response classification here.'
                : 'Run an analysis from the AI Analytics tab first, then come back to explore it here.'}
          </p>
          <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-primary">
            <ArrowLeft size={16} />
            Back to project
          </button>
        </div>
      </div>
    )
  }

  const coverage = analysis.coverage

  return (
    <div className="fixed inset-0 z-50 bg-cream-100 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-2.5 bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
          aria-label="Back to project"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-slate-900 truncate">{data?.projectName}</h1>
          <p className="text-xs text-slate-500">
            Analysis workspace
            {data?.lastAnalyzed &&
              ` · analysed ${new Date(data.lastAnalyzed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
          </p>
        </div>
        {coverage && (
          <div
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${
              coverage.complete
                ? 'bg-brand-50 border-brand-200 text-brand-700'
                : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${coverage.complete ? 'bg-brand-500' : 'bg-amber-500'}`}
            />
            <span className="font-semibold tabular-nums">
              {coverage.analyzed.toLocaleString()} / {coverage.total.toLocaleString()} responses classified
            </span>
            <span className="hidden lg:inline text-slate-500">
              {coverage.complete ? '— every figure is a count, not an estimate' : `— ${coverage.note ?? ''}`}
            </span>
          </div>
        )}
      </div>

      {/* Columns */}
      <div className="flex-1 flex min-h-0 overflow-x-auto">
        {/* 1 · Themes */}
        <div className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-100 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Themes</h2>
            <span className="text-xs text-slate-400 tabular-nums">{themeRows.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {themeRows.map(row => {
              const active = themeFilter === row.index
              const total = row.count || 1
              return (
                <button
                  key={row.index}
                  onClick={() => {
                    setThemeFilter(active ? null : row.index)
                    setIdFilter(null)
                  }}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${
                    active ? 'bg-brand-50' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-medium text-slate-800 leading-tight">
                      {row.name}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{row.count}</span>
                  </div>
                  <div className="flex h-1 rounded-full overflow-hidden mt-1.5 bg-slate-100">
                    <span
                      style={{
                        width: `${(row.stances.negative / total) * 100}%`,
                        backgroundColor: STANCE_COLORS.negative,
                      }}
                    />
                    <span
                      style={{
                        width: `${(row.stances.neutral / total) * 100}%`,
                        backgroundColor: STANCE_COLORS.neutral,
                      }}
                    />
                    <span
                      style={{
                        width: `${(row.stances.positive / total) * 100}%`,
                        backgroundColor: STANCE_COLORS.positive,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {row.stances.negative} object · {row.stances.neutral} neutral · {row.stances.positive} support
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* 2 · Responses */}
        <div className="w-[26rem] flex-shrink-0 bg-white border-r border-slate-200 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-100">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Responses
              </h2>
              <span className="text-xs text-slate-400 tabular-nums">
                {filtered.length.toLocaleString()} of {items.length.toLocaleString()}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <div className="relative flex-1 min-w-[8rem]">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full text-xs pl-6 pr-2 py-1 border border-slate-200 rounded-full focus:outline-none focus:border-brand-400"
                />
              </div>
              {(['pin', 'form', 'enquiry'] as const).map(source => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(sourceFilter === source ? null : source)}
                  className={`text-[11px] px-2 py-1 rounded-full border ${
                    sourceFilter === source
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {SOURCE_LABELS[source]}s
                </button>
              ))}
              {(['negative', 'neutral', 'positive'] as const).map(stance => (
                <button
                  key={stance}
                  onClick={() => setStanceFilter(stanceFilter === stance ? null : stance)}
                  className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1 ${
                    stanceFilter === stance
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <StanceDot stance={stance} />
                  {STANCE_LABELS[stance]}
                </button>
              ))}
              {(idFilter || themeFilter != null || stanceFilter || sourceFilter || search) && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] px-2 py-1 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                >
                  <X size={10} />
                  Clear
                </button>
              )}
            </div>
            {idFilter && (
              <p className="text-[11px] text-brand-700 bg-brand-50 rounded px-2 py-1 mt-1.5">
                Showing: {idFilter.label}
              </p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.slice(0, listLimit).map(item => {
              const assignment = assignmentById.get(item.id)
              const campaign = campaignByResponse.get(item.id)
              const selected = item.id === selectedResponseId
              return (
                <button
                  key={item.id}
                  onClick={() => openResponse(item.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${
                    selected ? 'bg-brand-50 shadow-[inset_2px_0_0_#16A34A]' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <StanceDot stance={assignment?.sentiment ?? null} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {SOURCE_LABELS[item.type]}
                    </span>
                    {assignment && (
                      <span
                        className={`text-[10px] px-1.5 py-px rounded font-medium ${
                          assignment.material === 'material'
                            ? 'bg-brand-50 text-brand-700'
                            : assignment.material === 'mixed'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {assignment.material}
                      </span>
                    )}
                    {campaign && (
                      <span className="text-[10px] px-1.5 py-px rounded font-medium bg-amber-50 text-amber-700 truncate max-w-[9rem]">
                        {campaign.label}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.content}</p>
                </button>
              )
            })}
            {filtered.length > listLimit && (
              <button
                onClick={() => setListLimit(limit => limit + 200)}
                className="w-full py-2.5 text-xs text-brand-700 hover:bg-slate-50"
              >
                Show more ({(filtered.length - listLimit).toLocaleString()} remaining)
              </button>
            )}
            {filtered.length === 0 && (
              <p className="text-xs text-slate-400 p-4">No responses match these filters.</p>
            )}
          </div>
        </div>

        {/* 3 · Map / Response */}
        <div className="flex-1 min-w-[24rem] bg-white border-r border-slate-200 flex flex-col min-h-0">
          <div className="flex gap-1 px-3 pt-2 border-b border-slate-100">
            {(['map', 'response'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-t-lg border border-b-0 ${
                  detailTab === tab
                    ? 'bg-white border-slate-200 text-slate-800 relative top-px'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab === 'map' ? 'Map' : 'Selected response'}
              </button>
            ))}
          </div>

          {detailTab === 'map' ? (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-h-0">
                <AnalysisMap
                  responses={mapResponses}
                  insights={spatialInsights}
                  selectedInsight={selectedInsight}
                  onSelectInsight={setSelectedInsight}
                  onSelectResponse={openResponse}
                  boundary={data?.boundary}
                />
              </div>
              {selectedInsight != null && spatialInsights[selectedInsight] && (
                <SpatialInsightPanel
                  insight={spatialInsights[selectedInsight]}
                  onViewResponses={insight =>
                    filterToIds(
                      `"${insight.theme}" around ${insight.areaLabel}`,
                      insight.responseIds
                    )
                  }
                  onClose={() => setSelectedInsight(null)}
                />
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedResponse ? (
                <p className="text-sm text-slate-400 mt-8 text-center">
                  Select a response from the list, or a dot on the map.
                </p>
              ) : (
                <div className="space-y-4 max-w-xl">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      {SOURCE_LABELS[selectedResponse.type]} ·{' '}
                      {new Date(selectedResponse.createdAt).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">
                      {selectedResponse.content}
                    </p>
                  </div>

                  {selectedAssignment ? (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 px-3 py-1.5 border-b border-slate-200">
                        Classification — traceable to this response
                      </p>
                      <dl className="text-xs divide-y divide-slate-100">
                        <div className="flex px-3 py-2 gap-3">
                          <dt className="w-24 text-slate-400 flex-shrink-0">Stance</dt>
                          <dd className="flex items-center gap-1.5 text-slate-700">
                            <StanceDot stance={selectedAssignment.sentiment} />
                            {STANCE_LABELS[selectedAssignment.sentiment]}
                          </dd>
                        </div>
                        <div className="flex px-3 py-2 gap-3">
                          <dt className="w-24 text-slate-400 flex-shrink-0">Themes</dt>
                          <dd className="flex flex-wrap gap-1">
                            {selectedAssignment.themeIds.length === 0 && (
                              <span className="text-slate-400">None assigned</span>
                            )}
                            {selectedAssignment.themeIds.map(themeId => (
                              <span
                                key={themeId}
                                className="px-2 py-0.5 bg-slate-100 rounded-full text-slate-600"
                              >
                                {taxonomy[themeId]?.name ?? `Theme ${themeId + 1}`}
                              </span>
                            ))}
                          </dd>
                        </div>
                        <div className="flex px-3 py-2 gap-3">
                          <dt className="w-24 text-slate-400 flex-shrink-0">Material</dt>
                          <dd className="text-slate-700">
                            <span className="font-medium capitalize">{selectedAssignment.material}</span>
                            {selectedAssignment.materialCategories.length > 0 && (
                              <span className="text-slate-500">
                                {' '}· {selectedAssignment.materialCategories.join(', ')}
                              </span>
                            )}
                            {selectedAssignment.nonMaterialCategories.length > 0 && (
                              <span className="text-slate-400">
                                {' '}· non-material: {selectedAssignment.nonMaterialCategories.join(', ')}
                              </span>
                            )}
                          </dd>
                        </div>
                        {campaignByResponse.has(selectedResponse.id) && (
                          <div className="flex px-3 py-2 gap-3">
                            <dt className="w-24 text-slate-400 flex-shrink-0">Campaign</dt>
                            <dd className="text-amber-700">
                              {campaignByResponse.get(selectedResponse.id)!.label} — 1 of{' '}
                              {campaignByResponse.get(selectedResponse.id)!.count}{' '}
                              {campaignByResponse.get(selectedResponse.id)!.exact
                                ? 'identical copies'
                                : 'variants'}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">
                      This response wasn&apos;t classified in the latest run (submitted after the
                      analysis, or beyond its coverage).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4 · Insights */}
        <div className="w-[26rem] flex-shrink-0 bg-cream-100 flex flex-col min-h-0">
          <div className="px-3 py-2.5 border-b border-slate-200 bg-white">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Insights</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Spatial patterns */}
            {spatialInsights.length > 0 && (
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={14} className="text-brand-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Spatial patterns
                  </h3>
                  <span className="ml-auto text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                    tested vs site-wide rates
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {spatialInsights.map((insight, index) => (
                    <div key={`${insight.theme}-${index}`} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-[13px] text-slate-800">{insight.headline}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        <span className="font-semibold text-slate-600">{insight.theme}</span> ·{' '}
                        {insight.count} of {insight.areaTotal} responses around {insight.areaLabel} (
                        {pct(insight.share)} vs {pct(insight.baselineShare)} elsewhere) ·{' '}
                        <span className="tabular-nums">{formatP(insight.pValue)}</span>
                      </p>
                      {insight.quote && (
                        <p className="text-[11px] text-slate-500 border-l-2 border-brand-300 pl-2 mt-1.5 italic">
                          &ldquo;{insight.quote}&rdquo;
                        </p>
                      )}
                      <div className="flex gap-3 mt-1.5">
                        <button
                          onClick={() => showInsightOnMap(index)}
                          className="text-[11px] font-semibold text-brand-700 hover:underline"
                        >
                          Show on map
                        </button>
                        <button
                          onClick={() =>
                            filterToIds(
                              `"${insight.theme}" around ${insight.areaLabel}`,
                              insight.responseIds
                            )
                          }
                          className="text-[11px] font-semibold text-brand-700 hover:underline"
                        >
                          View the {insight.count} responses
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verified patterns */}
            {verifiedPatterns.length > 0 && (
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-brand-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Verified patterns
                  </h3>
                  {analysis.crossReference && (
                    <span className="ml-auto text-[10px] text-slate-400">
                      {analysis.crossReference.significant} of {analysis.crossReference.tested} tests passed
                    </span>
                  )}
                </div>
                <ul className="space-y-2">
                  {verifiedPatterns.slice(0, 6).map((highlight, index) => (
                    <li key={index} className="text-[13px] text-slate-700 flex gap-2">
                      <ChevronRight size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                      <span>
                        {describeHighlight(highlight)}{' '}
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {formatP(highlight.pValue)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Campaigns */}
            {analysis.campaignAnalysis && analysis.campaignAnalysis.campaigns.length > 0 && (
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Megaphone size={14} className="text-amber-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Organised campaigns
                  </h3>
                  <span className="ml-auto text-[10px] text-slate-400 tabular-nums">
                    {analysis.campaignAnalysis.templatedCount} of {analysis.campaignAnalysis.totalAnalyzed} responses
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {analysis.campaignAnalysis.campaigns.map((campaign, index) => (
                    <div key={index} className="py-2 first:pt-0 last:pb-0 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          campaign.stance === 'oppose'
                            ? 'bg-red-50 text-red-600'
                            : campaign.stance === 'support'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {campaign.stance.toUpperCase()}
                      </span>
                      <button
                        onClick={() => filterToIds(campaign.label, campaign.memberIds)}
                        className="text-[13px] text-slate-700 hover:text-brand-700 hover:underline text-left truncate"
                      >
                        {campaign.label}
                      </button>
                      <span className="ml-auto text-[11px] text-slate-400 tabular-nums flex-shrink-0">
                        {campaign.count} · {campaign.exact ? 'identical' : 'edited'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material considerations */}
            {analysis.materialAnalysis && (
              <div className="card p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <ScrollText size={14} className="text-slate-500" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Material considerations
                  </h3>
                </div>
                {(() => {
                  const material = analysis.materialAnalysis
                  const total =
                    material.summary.material + material.summary.mixed + material.summary.nonMaterial || 1
                  return (
                    <>
                      <div className="flex h-2.5 rounded-full overflow-hidden">
                        <span
                          className="bg-brand-500"
                          style={{ width: `${(material.summary.material / total) * 100}%` }}
                        />
                        <span
                          className="bg-amber-400"
                          style={{ width: `${(material.summary.mixed / total) * 100}%` }}
                        />
                        <span
                          className="bg-slate-300"
                          style={{ width: `${(material.summary.nonMaterial / total) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        {material.summary.material} material · {material.summary.mixed} mixed ·{' '}
                        {material.summary.nonMaterial} non-material
                      </p>
                    </>
                  )
                })()}
              </div>
            )}

            {/* Executive summary */}
            <div className="card p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-brand-600" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Executive summary
                </h3>
              </div>
              <p className="text-[13px] text-slate-700 leading-relaxed">
                {analysis.summary.executive}
              </p>
              {analysis.summary.keyFindings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {analysis.summary.keyFindings.map((finding, index) => (
                    <li key={index} className="text-xs text-slate-600 flex gap-1.5">
                      <span className="text-brand-500 flex-shrink-0">•</span>
                      {finding}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-2 mt-3">
                Written from counted figures and significance-tested patterns only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpatialInsightPanel({
  insight,
  onViewResponses,
  onClose,
}: {
  insight: SpatialInsight
  onViewResponses: (insight: SpatialInsight) => void
  onClose: () => void
}) {
  return (
    <div className="border-t border-slate-200 p-3.5 bg-white flex-shrink-0">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-800 capitalize">
            {insight.areaLabel} — selected area
          </p>
          <p className="text-[11px] text-slate-500">
            {insight.areaTotal} classified responses here · dominant stance:{' '}
            <span className="capitalize">{insight.dominantSentiment}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-auto p-1 rounded hover:bg-slate-100 text-slate-400"
          aria-label="Close area panel"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-[13px] text-slate-700 mt-1.5">{insight.headline}</p>
      {insight.quote && (
        <p className="text-[11px] text-slate-500 border-l-2 border-brand-300 pl-2 mt-1.5 italic">
          &ldquo;{insight.quote}&rdquo;
        </p>
      )}
      <button
        onClick={() => onViewResponses(insight)}
        className="text-[11px] font-semibold text-brand-700 hover:underline mt-2"
      >
        View the {insight.count} responses raising &ldquo;{insight.theme}&rdquo; here
      </button>
    </div>
  )
}
