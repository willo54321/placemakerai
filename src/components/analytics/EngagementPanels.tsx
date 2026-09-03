'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, TrendingUp, MapPin, FileText, Inbox, BellRing, Building2 } from 'lucide-react'
import { STANCE_COLORS } from './PlotComparison'

// Participation metrics + audience segmentation, computed from live data by the
// programme endpoint. Rendered inside the AI Analytics tab.

type TimelineWeek = { week: string; pins: number; forms: number; enquiries: number; registrations: number }
type Totals = { pins: number; survey: number; enquiries: number; registrations: number; stakeholders: number; contributions: number }
type AudienceSeg = { label: string; count: number; support: number; neutral: number; object: number }
type ProgrammeData = {
  participation: { totals: Totals; timeline: TimelineWeek[] }
  audience: { segments: AudienceSeg[]; organisations: number; stakeholdersByStance: Record<string, number>; stakeholderTotal: number }
}

const CHANNEL = [
  { key: 'pins', label: 'Map comments', color: '#0E7C86' },
  { key: 'forms', label: 'Survey', color: '#2563EB' },
  { key: 'enquiries', label: 'Enquiries', color: '#D97706' },
  { key: 'registrations', label: 'Registrations', color: '#7C3AED' },
] as const

function StatTile({ icon: Icon, label, value, tint }: { icon: any; label: string; value: number; tint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={16} style={{ color: tint }} aria-hidden="true" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value.toLocaleString()}</div>
    </div>
  )
}

export function EngagementPanels({ projectId }: { projectId: string }) {
  const { data } = useQuery<ProgrammeData>({
    queryKey: ['programme', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/programme`)
      if (!res.ok) throw new Error('Failed to load engagement data')
      return res.json()
    },
  })

  if (!data) return null
  const { participation, audience } = data
  const maxWeek = Math.max(1, ...participation.timeline.map(w => w.pins + w.forms + w.enquiries + w.registrations))

  return (
    <div className="space-y-8">
      {/* participation metrics */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-brand-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">Participation metrics</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile icon={TrendingUp} label="Contributions" value={participation.totals.contributions} tint="#0F172A" />
          <StatTile icon={MapPin} label="Map comments" value={participation.totals.pins} tint="#0E7C86" />
          <StatTile icon={FileText} label="Survey responses" value={participation.totals.survey} tint="#2563EB" />
          <StatTile icon={Inbox} label="Enquiries" value={participation.totals.enquiries} tint="#D97706" />
          <StatTile icon={BellRing} label="Registered for updates" value={participation.totals.registrations} tint="#7C3AED" />
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Participation over time</h4>
            <div className="flex flex-wrap gap-3">
              {CHANNEL.map(c => (
                <span key={c.key} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} /> {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-44 items-end gap-1.5">
            {participation.timeline.map(w => {
              const total = w.pins + w.forms + w.enquiries + w.registrations
              return (
                <div key={w.week} className="group relative flex flex-1 flex-col items-center">
                  <div className="flex w-full max-w-[42px] flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(total / maxWeek) * 100}%`, minHeight: total > 0 ? 4 : 0 }}>
                    {CHANNEL.map(c => {
                      const v = (w as any)[c.key] as number
                      return v > 0 ? <div key={c.key} style={{ height: `${(v / total) * 100}%`, background: c.color }} /> : null
                    })}
                  </div>
                  <div className="pointer-events-none absolute -top-7 z-10 hidden whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">
                    w/c {w.week}: {total}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-slate-400">
            <span>{participation.timeline[0]?.week}</span>
            <span>{participation.timeline[participation.timeline.length - 1]?.week}</span>
          </div>
        </div>
      </section>

      {/* audience segmentation */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Users size={18} className="text-brand-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-900">Audience segmentation</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h4 className="mb-4 text-sm font-semibold text-slate-700">Who is taking part</h4>
            {audience.segments.length === 0 && <p className="text-sm text-slate-400">No audience data captured yet.</p>}
            <div className="space-y-3">
              {audience.segments.map(seg => {
                const max = Math.max(...audience.segments.map(s => s.count), 1)
                return (
                  <div key={seg.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{seg.label}</span>
                      <span className="text-slate-400">{seg.count}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="flex h-full" style={{ width: `${(seg.count / max) * 100}%` }}>
                          {(['support', 'neutral', 'object'] as const).map(k => (
                            seg[k] > 0 ? <div key={k} style={{ width: `${(seg[k] / seg.count) * 100}%`, background: STANCE_COLORS[k] }} /> : null
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STANCE_COLORS.support }} /> Support</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STANCE_COLORS.neutral }} /> Neutral</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STANCE_COLORS.object }} /> Object</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 text-slate-500"><Building2 size={16} aria-hidden="true" /><span className="text-xs font-medium uppercase tracking-wide">Organisations engaged</span></div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{audience.organisations + audience.stakeholderTotal}</div>
              <p className="mt-1 text-xs text-slate-400">{audience.organisations} via enquiries · {audience.stakeholderTotal} in the stakeholder register</p>
            </div>
            {audience.stakeholderTotal > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Stakeholders by stance</div>
                <div className="space-y-2">
                  {Object.entries(audience.stakeholdersByStance).sort((a, b) => b[1] - a[1]).map(([stance, n]) => (
                    <div key={stance} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-slate-600">{stance}</span>
                      <span className="font-medium text-slate-900">{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
