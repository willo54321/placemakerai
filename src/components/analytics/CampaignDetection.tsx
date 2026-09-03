'use client'

import { useState } from 'react'
import { Copy, Users, ShieldCheck, ChevronRight } from 'lucide-react'

export interface DetectedCampaign {
  label: string
  count: number
  stance: 'support' | 'oppose' | 'mixed' | 'unclear'
  templateSummary: string
  personalAdditions: string
  exact: boolean
  sampleQuote: string
}

export interface CampaignAnalysis {
  totalAnalyzed: number
  templatedCount: number
  uniqueCount: number
  campaigns: DetectedCampaign[]
}

const STANCE_STYLES: Record<DetectedCampaign['stance'], string> = {
  support: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  oppose: 'bg-red-50 text-red-700 border-red-200',
  mixed: 'bg-amber-50 text-amber-700 border-amber-200',
  unclear: 'bg-slate-50 text-slate-600 border-slate-200',
}

const STANCE_LABELS: Record<DetectedCampaign['stance'], string> = {
  support: 'Supports the project',
  oppose: 'Opposes the project',
  mixed: 'Mixed stance',
  unclear: 'Stance unclear',
}

export function CampaignDetection({ analysis }: { analysis: CampaignAnalysis }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  const templatedPercent =
    analysis.totalAnalyzed > 0
      ? Math.round((analysis.templatedCount / analysis.totalAnalyzed) * 100)
      : 0

  return (
    <div>
      <h3 className="font-semibold text-slate-900 mb-6 flex items-center gap-2">
        <Copy className="w-5 h-5 text-brand-600" />
        Campaign &amp; Duplicate Detection
      </h3>

      {analysis.campaigns.length === 0 ? (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <p className="text-sm text-emerald-800">
            No template letters or organised campaigns detected — all{' '}
            <span className="font-semibold">{analysis.totalAnalyzed}</span> responses appear
            to be individually written.
          </p>
        </div>
      ) : (
        <>
          {/* Headline stat */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
            <p className="text-lg text-slate-800">
              <span className="font-semibold text-slate-900">{analysis.templatedCount}</span> of{' '}
              <span className="font-semibold text-slate-900">{analysis.totalAnalyzed}</span>{' '}
              responses ({templatedPercent}%) are template or duplicate submissions across{' '}
              <span className="font-semibold text-slate-900">{analysis.campaigns.length}</span>{' '}
              campaign{analysis.campaigns.length === 1 ? '' : 's'} —{' '}
              <span className="font-semibold text-slate-900">{analysis.uniqueCount}</span> are
              individually written.
            </p>
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden flex mt-4">
              <div
                className="h-full bg-brand-500"
                style={{ width: `${templatedPercent}%` }}
                title={`Campaign/template responses: ${analysis.templatedCount}`}
              />
            </div>
            <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                Campaign / template ({analysis.templatedCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
                Individually written ({analysis.uniqueCount})
              </span>
            </div>
          </div>

          {/* Campaign cards */}
          <div className="space-y-3">
            {analysis.campaigns.map((campaign, i) => (
              <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{campaign.label}</p>
                    <p className="text-sm text-slate-500">
                      {campaign.count} response{campaign.count === 1 ? '' : 's'} ·{' '}
                      {campaign.exact ? 'identical copies' : 'template variants'}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${STANCE_STYLES[campaign.stance]}`}
                  >
                    {STANCE_LABELS[campaign.stance]}
                  </span>
                  <ChevronRight
                    size={18}
                    className={`text-slate-400 flex-shrink-0 transition-transform ${expanded === i ? 'rotate-90' : ''}`}
                  />
                </button>

                {expanded === i && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                        What the template says
                      </p>
                      <p className="text-sm text-slate-700">{campaign.templateSummary}</p>
                    </div>
                    {campaign.personalAdditions && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                          What respondents added personally
                        </p>
                        <p className="text-sm text-slate-700">{campaign.personalAdditions}</p>
                      </div>
                    )}
                    <blockquote className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border-l-4 border-brand-300 italic">
                      &ldquo;{campaign.sampleQuote}
                      {campaign.sampleQuote.length >= 220 ? '…' : ''}&rdquo;
                    </blockquote>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
