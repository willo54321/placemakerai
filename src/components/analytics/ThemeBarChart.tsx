'use client'

import { useState, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Download, Filter, X, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import html2canvas from 'html2canvas'

interface ThemeSentimentBreakdown {
  positive: number
  negative: number
  neutral: number
}

export interface ThemeWithSentiment {
  name: string
  count: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  keywords: string[]
  sampleQuotes: string[]
  sentimentBreakdown?: ThemeSentimentBreakdown
}

interface ThemeBarChartProps {
  themes: ThemeWithSentiment[]
  totalFeedback: number
  onThemeSelect?: (theme: ThemeWithSentiment | null) => void
  selectedTheme?: ThemeWithSentiment | null
}

const SENTIMENT_COLORS = {
  positive: '#10b981', // emerald-500
  negative: '#ef4444', // red-500
  neutral: '#94a3b8', // slate-400
  mixed: '#f59e0b', // amber-500
}

const BAR_COLORS = {
  positive: '#059669', // emerald-600
  negative: '#dc2626', // red-600
  neutral: '#64748b', // slate-500
  mixed: '#d97706', // amber-600
}

// Custom tooltip showing sentiment breakdown
const CustomTooltip = ({
  active,
  payload
}: {
  active?: boolean
  payload?: Array<{ payload: ThemeWithSentiment }>
}) => {
  if (!active || !payload || !payload[0]) return null

  const theme = payload[0].payload
  const breakdown = theme.sentimentBreakdown || { positive: 0, negative: 0, neutral: 0 }
  const total = breakdown.positive + breakdown.negative + breakdown.neutral

  return (
    <div className="bg-white shadow-xl rounded-xl border border-slate-200 p-4 min-w-[220px]">
      <div className="font-semibold text-slate-900 mb-3 pb-2 border-b border-slate-100">
        {theme.name}
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <ThumbsUp size={14} className="text-emerald-500" />
            Support
          </span>
          <span className="font-medium text-slate-900">
            {breakdown.positive}
            {total > 0 && <span className="text-slate-400 ml-1">({Math.round((breakdown.positive / total) * 100)}%)</span>}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <ThumbsDown size={14} className="text-red-500" />
            Concern
          </span>
          <span className="font-medium text-slate-900">
            {breakdown.negative}
            {total > 0 && <span className="text-slate-400 ml-1">({Math.round((breakdown.negative / total) * 100)}%)</span>}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-slate-600">
            <Minus size={14} className="text-slate-400" />
            Neutral
          </span>
          <span className="font-medium text-slate-900">
            {breakdown.neutral}
            {total > 0 && <span className="text-slate-400 ml-1">({Math.round((breakdown.neutral / total) * 100)}%)</span>}
          </span>
        </div>
      </div>

      {/* Sentiment mini bar */}
      {total > 0 && (
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
          {breakdown.positive > 0 && (
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(breakdown.positive / total) * 100}%` }}
            />
          )}
          {breakdown.neutral > 0 && (
            <div
              className="h-full bg-slate-400"
              style={{ width: `${(breakdown.neutral / total) * 100}%` }}
            />
          )}
          {breakdown.negative > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${(breakdown.negative / total) * 100}%` }}
            />
          )}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-3">Click to filter by this theme</p>
    </div>
  )
}

export function ThemeBarChart({
  themes,
  totalFeedback,
  onThemeSelect,
  selectedTheme
}: ThemeBarChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Sort themes by count descending
  const sortedThemes = [...themes].sort((a, b) => b.count - a.count)

  // Calculate percentages
  const chartData = sortedThemes.map(theme => ({
    ...theme,
    percentage: totalFeedback > 0 ? Math.round((theme.count / totalFeedback) * 100) : 0,
  }))

  const handleExportPNG = useCallback(async () => {
    if (!chartRef.current) return

    setIsExporting(true)
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })

      const link = document.createElement('a')
      link.download = `feedback-themes-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Failed to export chart:', err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleBarClick = (data: ThemeWithSentiment) => {
    if (onThemeSelect) {
      onThemeSelect(selectedTheme?.name === data.name ? null : data)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Feedback Themes</h3>
          <p className="text-sm text-slate-500">
            {themes.length} themes identified across {totalFeedback} responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedTheme && (
            <button
              onClick={() => onThemeSelect?.(null)}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Filter size={14} />
              <span>{selectedTheme.name}</span>
              <X size={14} />
            </button>
          )}
          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            {isExporting ? 'Exporting...' : 'Export PNG'}
          </button>
        </div>
      </div>

      {/* Chart container */}
      <div ref={chartRef} className="bg-white p-6 rounded-xl">
        <div style={{ height: Math.max(300, sortedThemes.length * 50) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
            >
              <XAxis
                type="number"
                tickFormatter={(value) => `${value}`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={150}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#334155', fontSize: 13, fontWeight: 500 }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
              <Bar
                dataKey="count"
                radius={[0, 6, 6, 0]}
                onClick={(data) => {
                  if (data && data.payload) {
                    handleBarClick(data.payload as ThemeWithSentiment)
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={selectedTheme?.name === entry.name
                      ? '#3b82f6' // brand blue when selected
                      : BAR_COLORS[entry.sentiment]
                    }
                    opacity={selectedTheme && selectedTheme.name !== entry.name ? 0.4 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Inline labels showing count and percentage */}
        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600" />
            <span className="text-slate-600">Positive sentiment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-600" />
            <span className="text-slate-600">Negative sentiment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-600" />
            <span className="text-slate-600">Mixed sentiment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-500" />
            <span className="text-slate-600">Neutral</span>
          </div>
        </div>
      </div>
    </div>
  )
}
