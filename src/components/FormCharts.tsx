'use client'

import { useMemo, useRef, useState } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import html2canvas from 'html2canvas'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { buildFormCharts, chartFileName, type FormChart, type FormField } from '@/lib/form-charts'

const BAR_COLOUR = '#15803d'
const ROW_HEIGHT = 38

async function exportCard(element: HTMLElement, title: string) {
  const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 })
  const link = document.createElement('a')
  link.download = chartFileName(title)
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function subtitle(chart: FormChart): string {
  const n = `${chart.respondents} ${chart.respondents === 1 ? 'respondent' : 'respondents'}`
  if (chart.kind === 'rating' && chart.average != null) return `${n} · average ${chart.average} out of 5`
  if (chart.kind === 'number' && chart.average != null) return `${n} · average ${chart.average}`
  if (chart.kind === 'multiple') return `${n} · more than one answer allowed`
  return n
}

function ChartCard({ chart, register }: { chart: FormChart; register: (el: HTMLDivElement | null) => void }) {
  const [exporting, setExporting] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  const longest = Math.max(...chart.bars.map(b => b.label.length))
  const labelWidth = Math.min(280, Math.max(80, longest * 8.4))
  // Chart text is SVG, which PNG export renders without the page's web fonts:
  // name the page font, then a sans-serif fallback so exports never go serif.
  const [fontFamily] = useState(() => `${typeof document !== 'undefined' ? `${getComputedStyle(document.body).fontFamily}, ` : ''}Helvetica, Arial, sans-serif`)

  const onExport = async () => {
    if (!ref.current) return
    setExporting(true)
    try {
      await exportCard(ref.current, chart.title)
    } catch {
      toast.error('Could not export this chart')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      ref={el => { ref.current = el; register(el) }}
      data-chart-title={chart.title}
      className="bg-white rounded-xl border border-slate-200 p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-slate-900 leading-snug">{chart.title}</h4>
          <p className="text-sm text-slate-500 mt-0.5">{subtitle(chart)}</p>
        </div>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting}
          data-html2canvas-ignore
          className="shrink-0 flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download size={14} aria-hidden="true" />
          {exporting ? 'Exporting…' : 'Export PNG'}
        </button>
      </div>
      <div style={{ height: chart.bars.length * ROW_HEIGHT + 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart.bars} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis
              type="category"
              dataKey="label"
              width={labelWidth}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#334155', fontSize: 13, fontFamily }}
              interval={0}
            />
            <Bar dataKey="count" fill={BAR_COLOUR} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList
                dataKey="count"
                position="right"
                content={(props) => {
                  const { x = 0, y = 0, width = 0, height = 0, index = 0 } = props as { x?: number; y?: number; width?: number; height?: number; index?: number }
                  const bar = chart.bars[index]
                  return (
                    <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="central" fontSize={13} fontFamily={fontFamily} fill="#334155">
                      {bar.count} <tspan fill="#64748b">({bar.percent}%)</tspan>
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/**
 * One chart per structured question in a form, each exportable as a PNG
 * that carries its question title and respondent count.
 */
export function FormCharts({ fields, responses }: { fields: FormField[]; responses: Array<{ data: Record<string, unknown> }> }) {
  const charts = useMemo(() => buildFormCharts(fields, responses), [fields, responses])
  const cards = useRef(new Map<string, HTMLDivElement>())
  const [exportingAll, setExportingAll] = useState(false)

  if (charts.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-12">This form has no choice or rating questions to chart.</p>
  }

  const exportAll = async () => {
    setExportingAll(true)
    try {
      for (const chart of charts) {
        const el = cards.current.get(chart.key)
        if (el) await exportCard(el, chart.title)
        await new Promise(r => setTimeout(r, 250)) // browsers drop rapid back-to-back downloads
      }
    } catch {
      toast.error('Could not export every chart')
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportAll}
          disabled={exportingAll}
          className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 px-3 py-1.5 bg-white hover:bg-blue-50 rounded-lg border border-blue-200 disabled:opacity-50"
        >
          <Download size={14} aria-hidden="true" />
          {exportingAll ? 'Exporting…' : `Export all ${charts.length} as PNG`}
        </button>
      </div>
      {charts.map(chart => (
        <ChartCard
          key={chart.key}
          chart={chart}
          register={el => { if (el) cards.current.set(chart.key, el); else cards.current.delete(chart.key) }}
        />
      ))}
    </div>
  )
}
