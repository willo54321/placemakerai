'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw,
  MessageSquare, AlertCircle, CheckCircle,
  ThumbsUp, ThumbsDown, Sparkles, MapPin, ChevronRight, Lightbulb
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/Spinner'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import dynamic from 'next/dynamic'

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

interface Theme {
  name: string
  count: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  keywords: string[]
  sampleQuotes: string[]
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

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const queryClient = useQueryClient()
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const [showAllFindings, setShowAllFindings] = useState(false)

  // Fetch existing analysis
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/analytics`).then(r => r.json()),
  })

  // Run new analysis
  const runAnalysis = useMutation({
    mutationFn: () =>
      fetch(`/api/projects/${projectId}/analytics`, { method: 'POST' }).then(r => r.json()),
    onSuccess: (result) => {
      if (result.error) {
        toast.error(result.error)
      } else {
        queryClient.invalidateQueries({ queryKey: ['analytics', projectId] })
        toast.success('Analysis complete!')
      }
    },
    onError: () => {
      toast.error('Failed to run analysis')
    },
  })

  const analysis: AnalysisData | null = data?.analysis
  const needsUpdate = data?.needsUpdate
  const feedbackCount = data?.feedbackCount || 0

  // Auto-run analysis if needed and there's feedback
  useEffect(() => {
    if (needsUpdate && feedbackCount > 0 && !runAnalysis.isPending && !analysis) {
      runAnalysis.mutate()
    }
  }, [needsUpdate, feedbackCount, analysis, runAnalysis])

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
          Once you receive feedback from map pins, forms, or enquiries, AI analytics will be available here.
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
        <p className="text-slate-500 mb-8 leading-relaxed">
          Analyze <span className="font-semibold text-slate-700">{feedbackCount}</span> pieces of feedback using AI to extract insights, sentiment, and themes.
        </p>
        <button
          onClick={() => runAnalysis.mutate()}
          disabled={runAnalysis.isPending}
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
    {
      name: 'Enquiries',
      positive: analysis.sentiment.bySource.enquiries.positive,
      negative: analysis.sentiment.bySource.enquiries.negative,
      neutral: analysis.sentiment.bySource.enquiries.neutral,
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
            Analysis of {analysis.feedbackCount} feedback items • Last updated {new Date(analysis.analyzedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {needsUpdate && (
            <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              New feedback available
            </span>
          )}
          <button
            onClick={() => runAnalysis.mutate()}
            disabled={runAnalysis.isPending}
            className="btn-secondary"
          >
            {runAnalysis.isPending ? (
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

      {/* Executive Summary - Hero Card */}
      <div className="card p-8 bg-gradient-to-br from-brand-50 via-white to-emerald-50/30 border-brand-100">
        <div className="flex items-start gap-5">
          <div className="w-14 h-14 bg-brand-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-7 h-7 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">Executive Summary</h3>
            <p className="text-slate-700 text-lg leading-relaxed">{analysis.summary.executive}</p>

            {analysis.summary.keyFindings.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Key Findings</h4>
                <ul className="space-y-2">
                  {displayedFindings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle size={18} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span>{finding}</span>
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

      {/* Key Themes - Interactive Grid */}
      <div className="card p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Key Themes</h3>
        <p className="text-sm text-slate-500 mb-6">Click on a theme to see sample quotes from the feedback</p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {analysis.themes.themes.map((theme, i) => (
            <button
              key={i}
              onClick={() => setSelectedTheme(selectedTheme?.name === theme.name ? null : theme)}
              className={`text-left p-5 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                selectedTheme?.name === theme.name
                  ? 'border-brand-500 bg-brand-50 shadow-md'
                  : 'border-slate-200 hover:border-brand-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="font-semibold text-slate-900">{theme.name}</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium ${THEME_SENTIMENT_STYLES[theme.sentiment]}`}
                >
                  {theme.sentiment}
                </span>
              </div>
              <p className="text-2xl font-semibold text-slate-900 mb-1">{theme.count}</p>
              <p className="text-sm text-slate-500 mb-3">mentions</p>
              <div className="flex flex-wrap gap-1.5">
                {theme.keywords.slice(0, 4).map((keyword, j) => (
                  <span key={j} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                    {keyword}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

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
          </div>
        )}
      </div>

      {/* Concerns & Support - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Areas of Concern */}
        {analysis.summary.concernAreas.length > 0 && (
          <div className="card p-6 border-l-4 border-l-red-400">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Areas of Concern
            </h3>
            <ul className="space-y-3">
              {analysis.summary.concernAreas.map((concern, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600">
                  <span className="w-2 h-2 bg-red-400 rounded-full mt-2 flex-shrink-0" />
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas of Support */}
        {analysis.summary.supportAreas.length > 0 && (
          <div className="card p-6 border-l-4 border-l-emerald-400">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Areas of Support
            </h3>
            <ul className="space-y-3">
              {analysis.summary.supportAreas.map((support, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-600">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0" />
                  <span>{support}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* AI Recommendations - Call to Action */}
      {analysis.summary.recommendations.length > 0 && (
        <div className="card p-8 bg-gradient-to-br from-amber-50 via-white to-orange-50/30 border-amber-100">
          <h3 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            AI Recommendations
          </h3>
          <div className="space-y-4">
            {analysis.summary.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-4 border border-amber-100">
                <span className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {i + 1}
                </span>
                <p className="text-slate-700 leading-relaxed">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic Sentiment Heatmap - TEMPORARILY DISABLED */}
      {/* {analysis.geographic && analysis.geographic.clusters.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-600" />
            Geographic Sentiment Heatmap
          </h3>
          <p className="text-sm text-slate-500 mb-6">Visualize where feedback sentiment is concentrated across the project area</p>
          <SentimentHeatmap clusters={analysis.geographic.clusters} height="400px" />
        </div>
      )} */}
    </div>
  )
}
