'use client'

import { useState, useRef, useCallback } from 'react'
import { Download, Share2, Copy, Check, Sparkles } from 'lucide-react'
import html2canvas from 'html2canvas'

interface HeadlineStat {
  text: string
  type: 'concern' | 'support' | 'neutral' | 'insight'
}

interface HeadlineStatsProps {
  stats: HeadlineStat[]
  projectName?: string
  isGenerating?: boolean
  onGenerate?: () => void
}

const STAT_STYLES = {
  concern: {
    bg: 'bg-gradient-to-br from-red-50 to-orange-50',
    border: 'border-red-200',
    accent: 'text-red-600',
    icon: '⚠️',
  },
  support: {
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    accent: 'text-emerald-600',
    icon: '✅',
  },
  neutral: {
    bg: 'bg-gradient-to-br from-slate-50 to-blue-50',
    border: 'border-slate-200',
    accent: 'text-slate-600',
    icon: '📊',
  },
  insight: {
    bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
    border: 'border-purple-200',
    accent: 'text-purple-600',
    icon: '💡',
  },
}

function StatCard({
  stat,
  projectName,
  onExport,
  onCopy
}: {
  stat: HeadlineStat
  projectName?: string
  onExport: () => void
  onCopy: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const style = STAT_STYLES[stat.type]

  const handleExport = async () => {
    if (!cardRef.current) return
    setIsExporting(true)

    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      })

      const link = document.createElement('a')
      link.download = `stat-${Date.now()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Failed to export:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(stat.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      <div
        ref={cardRef}
        className={`${style.bg} ${style.border} border-2 rounded-xl p-6 transition-all duration-200 hover:shadow-lg`}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">{style.icon}</span>
          <div className="flex-1">
            <p className={`text-lg font-semibold ${style.accent}`}>{stat.text}</p>
            {projectName && (
              <p className="text-xs text-slate-400 mt-2">— {projectName} consultation</p>
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200"
          title="Copy text"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-slate-500" />}
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 disabled:opacity-50"
          title="Export as PNG"
        >
          <Download size={14} className="text-slate-500" />
        </button>
      </div>
    </div>
  )
}

export function HeadlineStats({
  stats,
  projectName,
  isGenerating,
  onGenerate
}: HeadlineStatsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isExportingAll, setIsExportingAll] = useState(false)

  const handleExportAll = useCallback(async () => {
    if (!containerRef.current) return
    setIsExportingAll(true)

    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      })

      const link = document.createElement('a')
      link.download = `headline-stats-${new Date().toISOString().split('T')[0]}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Failed to export:', err)
    } finally {
      setIsExportingAll(false)
    }
  }, [])

  if (stats.length === 0 && !isGenerating) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-purple-500" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Generate Headline Stats</h3>
        <p className="text-slate-500 text-sm mb-4 max-w-md mx-auto">
          Create shareable statistics from your consultation feedback for reports and social media.
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="btn-primary"
          >
            <Sparkles size={16} />
            Generate Stats
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Headline Statistics</h3>
          <p className="text-sm text-slate-500">
            Click any stat to copy or export as an image
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} />
              {isGenerating ? 'Generating...' : 'Regenerate'}
            </button>
          )}
          {stats.length > 0 && (
            <button
              onClick={handleExportAll}
              disabled={isExportingAll}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              {isExportingAll ? 'Exporting...' : 'Export All'}
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
        {stats.map((stat, i) => (
          <StatCard
            key={i}
            stat={stat}
            projectName={projectName}
            onExport={() => {}}
            onCopy={() => {}}
          />
        ))}
      </div>
    </div>
  )
}
