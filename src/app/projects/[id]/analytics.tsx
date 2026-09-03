'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJson } from '@/lib/fetch-json'
import {
  BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw,
  MessageSquare, AlertCircle, CheckCircle,
  ThumbsUp, ThumbsDown, Sparkles, MapPin, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/Spinner'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import dynamic from 'next/dynamic'
import {
  ThemeBarChart,
  ThemeWithSentiment,
  MaterialClassification,
  CampaignDetection,
  CampaignAnalysis,
  ResponsesExplorer
} from '@/components/analytics'
import { AutoInsights } from '@/components/analytics/AutoInsights'
import { FeedbackBreakdown } from '@/components/analytics/PlotComparison'
import { EngagementPanels } from '@/components/analytics/EngagementPanels'

/**
 * Summary text with validated citation chips. The server replaces the model's
 * [#n] markers with [ref:<responseId>] tokens — every one checked against the
 * sample the model actually saw — and this renders each token as a numbered
 * chip that reveals the cited response in the explorer below.
 */
function CitedText({ text, onCite }: { text: string; onCite: (id: string) => void }) {
  const parts = text.split(/(\[ref:[^\]]+\])/g)
  let citation = 0
  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^\[ref:([^\]]+)\]$/)
        if (!match) return <span key={index}>{part}</span>
        citation++
        return (
          <button
            key={index}
            onClick={() => onCite(match[1])}
            title="View the response this is drawn from"
            className="inline-flex items-center justify-center align-text-top w-[18px] h-[18px] rounded-full bg-brand-100 text-brand-700 hover:bg-brand-600 hover:text-white transition-colors text-[10px] font-semibold mx-0.5 tabular-nums"
          >
            {citation}
          </button>
        )
      })}
    </>
  )
}

const SentimentHeatmap = dynamic(
  () => import('@/components/SentimentHeatmap').then(mod => mod.SentimentHeatmap),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 bg-slate-100 rounded-xl animate-pulse flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading map...</p>
      </div>
    )
  }
)

interface AnalyticsTabProps {
  projectId: string
}

interface SentimentBreakdown {
  positive: number
  negative: number
  neutral: number
}

interface ThemeSentimentBreakdown {
  positive: number
  negative: number
  neutral: number
}

interface Theme {
  name: string
  count: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  keywords: string[]
  sampleQuotes: string[]
  sentimentBreakdown?: ThemeSentimentBreakdown
}

interface HeadlineStat {
  text: string
  type: 'concern' | 'support' | 'neutral' | 'insight'
}

interface MaterialCategory {
  name: string
  count: number
  examples: string[]
}

interface MaterialAnalysis {
  summary: {
    material: number
    nonMaterial: number
    mixed: number
  }
  categories: {
    material: MaterialCategory[]
    nonMaterial: MaterialCategory[]
  }
}

interface AnalysisData {
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed'
    score: number
    breakdown: SentimentBreakdown
    bySource: {
      pins: SentimentBreakdown
      forms: SentimentBreakdown
      enquiries: SentimentBreakdown
    }
  }
  themes: {
    themes: Theme[]
    totalFeedback: number
  }
  summary: {
    executive: string
    keyFindings: string[]
    recommendations: string[]
    concernAreas: string[]
    supportAreas: string[]
  }
  headlineStats?: {
    stats: HeadlineStat[]
  }
  materialAnalysis?: MaterialAnalysis
  campaignAnalysis?: CampaignAnalysis
  geographic?: {
    clusters: Array<{
      latitude: number
      longitude: number
      sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      count: number
    }>
  }
  analyzedAt: string
  feedbackCount: number
}

// Brand-consistent color palette
const SENTIMENT_COLORS = {
  positive: '#059669', // emerald-600
  negative: '#dc2626', // red-600
  neutral: '#64748b', // slate-500
  mixed: '#d97706', // amber-600
}

const CHART_COLORS = {
  positive: '#10b981', // emerald-500
  negative: '#ef4444', // red-500
  neutral: '#94a3b8', // slate-400
}

const THEME_SENTIMENT_STYLES = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  negative: 'bg-red-50 text-red-700 border-red-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
  mixed: 'bg-amber-50 text-amber-700 border-amber-200',
}

// Custom tooltip component for brand consistency
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }> }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white shadow-lg rounded-lg border border-slate-200 p-3">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600">{entry.name}:</span>
            <span className="font-semibold text-slate-900">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

const ANALYTICS_VIEWS = [
  { id: 'summary', label: 'Summary' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'themes', label: 'Themes' },
  { id: 'engagement', label: 'Engagement & map' },
  { id: 'responses', label: 'Responses' },
] as const
type AnalyticsView = typeof ANALYTICS_VIEWS[number]['id']

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const queryClient = useQueryClient()
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const [showAllFindings, setShowAllFindings] = useState(false)
  const [focusResponse, setFocusResponse] = useState<{ id: string; nonce: number } | null>(null)
  const [view, setView] = useState<AnalyticsView>('summary')

  const handleCite = (id: string) => {
    setFocusResponse(current => ({ id, nonce: (current?.nonce ?? 0) + 1 }))
    setView('responses')
  }

  // Latch so the auto-run effect fires AT MOST ONCE per mount and never
  // re-fires after a failure (which would otherwise loop forever since
  // `analysis` stays null on error).
  const hasAutoRun = useRef(false)

  // Fetch existing analysis. fetchJson throws on non-2xx so genuine server
  // errors surface via the query's `error` state instead of silently resolving.
  // While a run is in flight the server reports `processing: true` and this
  // query polls until the batch completes (the GET also finalizes it).
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => fetchJson(`/api/projects/${projectId}/analytics`),
    refetchInterval: (query) =>
      (query.state.data as { processing?: boolean } | undefined)?.processing ? 5000 : false,
  })

  // Start a new analysis run. Pass `force: true` to bypass the server-side
  // cache check. The POST returns immediately; results arrive via polling.
  const runAnalysis = useMutation({
    mutationFn: ({ force }: { force?: boolean } = {}) =>
      fetchJson(`/api/projects/${projectId}/analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: force ?? false }),
      }),
    onSuccess: (result: { processing?: boolean; cached?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['analytics', projectId] })
      if (result?.processing) {
        toast.success('Analysis started — results in a few minutes')
      } else {
        toast.success('Analysis complete!')
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to run analysis')
    },
  })

  const analysis: AnalysisData | null = data?.analysis
  const needsUpdate = data?.needsUpdate
  const feedbackCount = data?.feedbackCount || 0
  const processing = Boolean(data?.processing)
  const analysisFailed = Boolean(data?.analysisFailed)
  const sentimentOverTime = data?.sentimentOverTime as
    | Array<{ week: string; support: number; neutral: number; object: number }>
    | undefined
  const newResponses = (data?.newResponses as number | undefined) ?? 0

  // Toast once when a polled run lands.
  const wasProcessing = useRef(false)
  useEffect(() => {
    if (wasProcessing.current && !processing && analysis) {
      toast.success('Analysis complete!')
    }
    wasProcessing.current = processing
  }, [processing, analysis])

  // Auto-run analysis at most once when needed and there's feedback. The latch
  // and the `isError` bail prevent the infinite-retry loop on POST failure.
  // Deps are scalar values only (no mutation-object identity) so the effect
  // doesn't re-fire on every render.
  const canAutoRun = Boolean(needsUpdate) && feedbackCount > 0 && !analysis && !processing && !analysisFailed
  useEffect(() => {
    if (
      canAutoRun &&
      !hasAutoRun.current &&
      !runAnalysis.isPending &&
      !runAnalysis.isError
    ) {
      hasAutoRun.current = true
      runAnalysis.mutate({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAutoRun])

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500">Loading analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Failed to load analytics</h3>
        <p className="text-slate-500 text-sm">Please try again later.</p>
      </div>
    )
  }

  if (feedbackCount === 0) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BarChart3 className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-3">No feedback to analyze</h3>
        <p className="text-slate-500 mb-6 leading-relaxed">
          Once you receive feedback from map pins or forms, AI analytics will be available here.
        </p>
      </div>
    )
  }

  if (!analysis && processing) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Spinner size="lg" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-3">Analysing your feedback</h3>
        <p className="text-slate-500 leading-relaxed">
          Classifying every one of <span className="font-semibold text-slate-700">{feedbackCount}</span> responses — sentiment, themes, material planning considerations and campaign detection. Results typically arrive within a few minutes. You can leave this page and come back.
        </p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto">
        <div className="w-20 h-20 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Sparkles className="w-10 h-10 text-brand-600" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-3">AI Analytics</h3>
        {analysisFailed && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2 mb-4">
            The last analysis didn&apos;t complete — try running it again.
          </p>
        )}
        <p className="text-slate-500 mb-8 leading-relaxed">
          Analyze <span className="font-semibold text-slate-700">{feedbackCount}</span> pieces of feedback using AI to extract insights, sentiment, and themes.
        </p>
        <button
          onClick={() => runAnalysis.mutate({})}
          disabled={runAnalysis.isPending}
          data-tour="run-analysis"
          className="btn-primary px-8 py-3"
        >
          {runAnalysis.isPending ? (
            <>
              <Spinner size="sm" />
              <span>Analyzing feedback...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Run Analysis</span>
            </>
          )}
        </button>
      </div>
    )
  }

  // Calculate percentages for progress bars
  const total = analysis.sentiment.breakdown.positive + analysis.sentiment.breakdown.negative + analysis.sentiment.breakdown.neutral
  const positivePercent = total > 0 ? Math.round((analysis.sentiment.breakdown.positive / total) * 100) : 0
  const negativePercent = total > 0 ? Math.round((analysis.sentiment.breakdown.negative / total) * 100) : 0
  const neutralPercent = total > 0 ? Math.round((analysis.sentiment.breakdown.neutral / total) * 100) : 0

  const sentimentData = [
    { name: 'Positive', value: analysis.sentiment.breakdown.positive, color: CHART_COLORS.positive },
    { name: 'Negative', value: analysis.sentiment.breakdown.negative, color: CHART_COLORS.negative },
    { name: 'Neutral', value: analysis.sentiment.breakdown.neutral, color: CHART_COLORS.neutral },
  ].filter(d => d.value > 0)

  const sourceData = [
    {
      name: 'Map Pins',
      positive: analysis.sentiment.bySource.pins.positive,
      negative: analysis.sentiment.bySource.pins.negative,
      neutral: analysis.sentiment.bySource.pins.neutral,
    },
    {
      name: 'Forms',
      positive: analysis.sentiment.bySource.forms.positive,
      negative: analysis.sentiment.bySource.forms.negative,
      neutral: analysis.sentiment.bySource.forms.neutral,
    },
  ].filter(d => d.positive + d.negative + d.neutral > 0)

  const SentimentIcon = analysis.sentiment.overall === 'positive'
    ? TrendingUp
    : analysis.sentiment.overall === 'negative'
      ? TrendingDown
      : Minus

  const displayedFindings = showAllFindings
    ? analysis.summary.keyFindings
    : analysis.summary.keyFindings.slice(0, 3)

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">AI Analytics</h2>
          <p className="text-slate-500 mt-1">
            Analysis of {analysis.feedbackCount} feedback items (approved map comments and form responses) • Last updated {new Date(analysis.analyzedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {processing && (
            <span className="text-sm text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
              Re-analysis in progress — showing previous results
            </span>
          )}
          {!processing && analysisFailed && (
            <span className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
              Last analysis failed — try again
            </span>
          )}
          {!processing && !analysisFailed && needsUpdate && (
            <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              {newResponses > 0
                ? `${newResponses} new response${newResponses === 1 ? '' : 's'} since this analysis`
                : 'Feedback has changed since this analysis'}
            </span>
          )}
          <button
            onClick={() => runAnalysis.mutate({ force: true })}
            disabled={runAnalysis.isPending || processing}
            title={
              processing
                ? 'A run is already in progress — results arrive when the batch completes'
                : runAnalysis.isPending
                  ? 'Starting the analysis run…'
                  : `Re-classify all ${feedbackCount} responses from scratch`
            }
            data-tour="run-analysis"
            className="btn-secondary"
          >
            {runAnalysis.isPending || processing ? (
              <>
                <Spinner size="sm" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                Re-analyze
              </>
            )}
          </button>
        </div>
      </div>

      {/* Insight section menu */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Insight sections">
          {ANALYTICS_VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                view === v.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </div>

      {view === 'summary' && (
      <div className="space-y-8">
      {/* Executive Summary - Hero Card */}
      <div className="card p-8">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-7 h-7 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Executive Summary</h3>
            <p className="text-slate-700 text-lg leading-relaxed">
              <CitedText text={analysis.summary.executive} onCite={handleCite} />
            </p>

            {analysis.summary.keyFindings.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Findings</h4>
                <ul className="space-y-2">
                  {displayedFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span><CitedText text={finding} onCite={handleCite} /></span>
                    </li>
                  ))}
                </ul>
                {analysis.summary.keyFindings.length > 3 && (
                  <button
                    onClick={() => setShowAllFindings(!showAllFindings)}
                    className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                  >
                    {showAllFindings ? 'Show less' : `Show ${analysis.summary.keyFindings.length - 3} more`}
                    <ChevronRight size={14} className={`transition-transform ${showAllFindings ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback breakdown — by zone or by source */}
      <FeedbackBreakdown projectId={projectId} />

      {/* KPI Stats Row - Most Important Metrics at Top */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Feedback */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-3xl font-semibold text-slate-900">{analysis.feedbackCount}</p>
              <p className="text-sm text-slate-500 mt-0.5">Total Responses</p>
            </div>
          </div>
        </div>

        {/* Overall Sentiment */}
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${SENTIMENT_COLORS[analysis.sentiment.overall]}15` }}
            >
              <SentimentIcon
                className="w-6 h-6"
                style={{ color: SENTIMENT_COLORS[analysis.sentiment.overall] }}
              />
            </div>
            <div>
              <p className="text-3xl font-semibold text-slate-900 capitalize">
                {analysis.sentiment.overall}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Overall Sentiment</p>
              <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                {positivePercent}% support · {negativePercent}% object · {neutralPercent}% neutral
              </p>
            </div>
          </div>
        </div>

        {/* Positive with Progress */}
        <div className="card p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
              <ThumbsUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-3xl font-semibold text-slate-900">
                {analysis.sentiment.breakdown.positive}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Positive</p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${positivePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{positivePercent}% of responses</p>
        </div>

        {/* Negative with Progress */}
        <div className="card p-5">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <ThumbsDown className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-3xl font-semibold text-slate-900">
                {analysis.sentiment.breakdown.negative}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">Negative</p>
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${negativePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{negativePercent}% of responses</p>
        </div>
      </div>

      </div>
      )}

      {view === 'sentiment' && (
      <div className="space-y-8">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Donut Chart */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-6">Sentiment Distribution</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-slate-600 text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment by Source */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-6">Sentiment by Source</h3>
          <div className="space-y-5">
            {sourceData.map((source) => {
              const sourceTotal = source.positive + source.neutral + source.negative
              if (sourceTotal === 0) return null
              const posPercent = (source.positive / sourceTotal) * 100
              const neutralPercent = (source.neutral / sourceTotal) * 100
              const negPercent = (source.negative / sourceTotal) * 100

              return (
                <div key={source.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-slate-700">{source.name}</span>
                    <span className="text-sm text-slate-500">{sourceTotal} responses</span>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-lg overflow-hidden flex">
                    {source.positive > 0 && (
                      <div
                        className="h-full bg-emerald-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${posPercent}%` }}
                        title={`Positive: ${source.positive}`}
                      >
                        {posPercent >= 15 && source.positive}
                      </div>
                    )}
                    {source.neutral > 0 && (
                      <div
                        className="h-full bg-slate-400 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${neutralPercent}%` }}
                        title={`Neutral: ${source.neutral}`}
                      >
                        {neutralPercent >= 15 && source.neutral}
                      </div>
                    )}
                    {source.negative > 0 && (
                      <div
                        className="h-full bg-red-500 flex items-center justify-center text-xs font-medium text-white"
                        style={{ width: `${negPercent}%` }}
                        title={`Negative: ${source.negative}`}
                      >
                        {negPercent >= 15 && source.negative}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">Positive</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="text-sm text-slate-600">Neutral</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-slate-600">Negative</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment over time — weekly stance counts from per-response assignments */}
      {sentimentOverTime && sentimentOverTime.length >= 2 && (
        <div className="card p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">Sentiment over time</h3>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentOverTime} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="week"
                  tickFormatter={(week: string) =>
                    new Date(week).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={40}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="object" name="Object" stackId="stance" fill={CHART_COLORS.negative} />
                <Bar dataKey="neutral" name="Neutral" stackId="stance" fill={CHART_COLORS.neutral} />
                <Bar dataKey="support" name="Support" stackId="stance" fill={CHART_COLORS.positive} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-center gap-6 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.negative }} />
              Object
            </span>
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.neutral }} />
              Neutral / question
            </span>
            <span className="flex items-center gap-2 text-slate-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS.positive }} />
              Support
            </span>
          </div>
        </div>
      )}

      {/* Campaign & Duplicate Detection */}
      {analysis.campaignAnalysis && analysis.campaignAnalysis.campaigns.length > 0 && (
        <div className="card p-6" data-tour="campaign-detection">
          <CampaignDetection analysis={analysis.campaignAnalysis} />
        </div>
      )}

      </div>
      )}

      {view === 'themes' && (
      <div className="space-y-8">
      {/* Interactive Theme Bar Chart */}
      <div className="card p-6">
        <ThemeBarChart
          themes={analysis.themes.themes as ThemeWithSentiment[]}
          totalFeedback={analysis.themes.totalFeedback}
          onThemeSelect={(theme) => setSelectedTheme(theme as Theme | null)}
          selectedTheme={selectedTheme as ThemeWithSentiment | null}
        />

        {/* Selected Theme Details - Progressive Disclosure */}
        {selectedTheme && (
          <div className="mt-6 p-6 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
            <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare size={18} className="text-brand-600" />
              {selectedTheme.name} — Sample Quotes
            </h4>
            <div className="space-y-3">
              {selectedTheme.sampleQuotes.map((quote, i) => (
                <blockquote key={i} className="text-slate-600 bg-white rounded-lg p-4 border-l-4 border-brand-300">
                  <p className="italic">"{quote}"</p>
                </blockquote>
              ))}
            </div>
            {selectedTheme.keywords.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500 mb-2">Related keywords:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedTheme.keywords.map((keyword, j) => (
                    <span key={j} className="text-sm bg-white text-slate-600 px-3 py-1 rounded-full border border-slate-200">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Material vs Non-Material Classification */}
      {analysis.materialAnalysis && (
        <div className="card p-6">
          <MaterialClassification analysis={analysis.materialAnalysis} analyzedCount={analysis.feedbackCount} />
        </div>
      )}

      {/* Concerns & Support - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Areas of Concern */}
        {analysis.summary.concernAreas.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Areas of Concern
            </h3>
            <ul className="space-y-3">
              {analysis.summary.concernAreas.map((concern, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600">
                  <span className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  <span><CitedText text={concern} onCite={handleCite} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas of Support */}
        {analysis.summary.supportAreas.length > 0 && (
          <div className="card p-6">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Areas of Support
            </h3>
            <ul className="space-y-3">
              {analysis.summary.supportAreas.map((support, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                  <span><CitedText text={support} onCite={handleCite} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>


      </div>
      )}

      {view === 'engagement' && (
      <div className="space-y-8">
      {/* Participation metrics + audience segmentation */}
      <EngagementPanels projectId={projectId} />

      {/* Geographic sentiment heatmap: red = opposition, green = support */}
      {analysis.geographic && analysis.geographic.clusters.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            Support & opposition map
          </h3>
          <div className="mt-4" />
          <SentimentHeatmap clusters={analysis.geographic.clusters} height="400px" />
        </div>
      )}

      {/* Significance-tested patterns: statements + starred heatmap */}
      <AutoInsights
        projectId={projectId}
        onViewTheme={(name) => { setSelectedTheme({ name } as Theme); setView('themes') }}
      />

      </div>
      )}

      {view === 'responses' && (
      <div className="space-y-8">
      {/* All responses, filterable by theme; a theme clicked in the chart above jumps here */}
      <ResponsesExplorer
        projectId={projectId}
        focusTheme={selectedTheme?.name ?? null}
        focusResponse={focusResponse}
      />
      </div>
      )}
    </div>
  )
}
