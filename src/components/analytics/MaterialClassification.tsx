'use client'

import { useState } from 'react'
import { Scale, CheckCircle, XCircle, HelpCircle, ChevronDown, ChevronRight, Info } from 'lucide-react'

interface MaterialCategory {
  name: string
  count: number
  examples: string[]
}

interface MaterialAnalysisData {
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

interface MaterialClassificationProps {
  analysis: MaterialAnalysisData
}

export function MaterialClassification({ analysis }: MaterialClassificationProps) {
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null)
  const [expandedNonMaterial, setExpandedNonMaterial] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const total = analysis.summary.material + analysis.summary.nonMaterial + analysis.summary.mixed
  const materialPercent = total > 0 ? Math.round((analysis.summary.material / total) * 100) : 0
  const nonMaterialPercent = total > 0 ? Math.round((analysis.summary.nonMaterial / total) * 100) : 0
  const mixedPercent = total > 0 ? Math.round((analysis.summary.mixed / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header with info toggle */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Material Planning Considerations</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Classification of feedback by UK planning law relevance
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          title="What does this mean?"
        >
          <Info size={18} />
        </button>
      </div>

      {/* Help panel */}
      {showHelp && (
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <h4 className="font-medium text-indigo-900 mb-2">Understanding Material Considerations</h4>
          <div className="text-sm text-indigo-800 space-y-2">
            <p>
              <strong>Material considerations</strong> are factors that planning authorities <em>can</em> legally
              consider when making decisions: traffic impact, noise, design, ecology, heritage, etc.
            </p>
            <p>
              <strong>Non-material objections</strong> are factors that <em>cannot</em> influence planning decisions:
              property values, loss of private views, construction disruption, personal disputes.
            </p>
            <p className="text-indigo-600">
              This classification helps identify which feedback points are most relevant for planning reports
              and committee meetings.
            </p>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Material</span>
          </div>
          <p className="text-2xl font-semibold text-emerald-900">{analysis.summary.material}</p>
          <p className="text-sm text-emerald-600">{materialPercent}% of responses</p>
        </div>

        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Non-Material</span>
          </div>
          <p className="text-2xl font-semibold text-red-900">{analysis.summary.nonMaterial}</p>
          <p className="text-sm text-red-600">{nonMaterialPercent}% of responses</p>
        </div>

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <HelpCircle className="w-5 h-5 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Mixed</span>
          </div>
          <p className="text-2xl font-semibold text-amber-900">{analysis.summary.mixed}</p>
          <p className="text-sm text-amber-600">{mixedPercent}% of responses</p>
        </div>
      </div>

      {/* Progress bar visualization */}
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
        {materialPercent > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${materialPercent}%` }}
            title={`Material: ${materialPercent}%`}
          />
        )}
        {mixedPercent > 0 && (
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${mixedPercent}%` }}
            title={`Mixed: ${mixedPercent}%`}
          />
        )}
        {nonMaterialPercent > 0 && (
          <div
            className="h-full bg-red-500 transition-all duration-500"
            style={{ width: `${nonMaterialPercent}%` }}
            title={`Non-material: ${nonMaterialPercent}%`}
          />
        )}
      </div>

      {/* Category breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material categories */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Material Considerations Raised
          </h4>
          {analysis.categories.material.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No material considerations identified</p>
          ) : (
            <div className="space-y-2">
              {analysis.categories.material.map((cat) => (
                <div key={cat.name} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedMaterial(expandedMaterial === cat.name ? null : cat.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-900">{cat.name}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {cat.count}
                      </span>
                    </div>
                    {expandedMaterial === cat.name ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                  </button>
                  {expandedMaterial === cat.name && cat.examples.length > 0 && (
                    <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2">Example quotes:</p>
                      <ul className="space-y-1">
                        {cat.examples.slice(0, 2).map((example, i) => (
                          <li key={i} className="text-sm text-slate-600 italic">
                            "{example}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Non-material categories */}
        <div className="space-y-3">
          <h4 className="font-medium text-slate-900 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            Non-Material Objections Raised
          </h4>
          {analysis.categories.nonMaterial.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No non-material objections identified</p>
          ) : (
            <div className="space-y-2">
              {analysis.categories.nonMaterial.map((cat) => (
                <div key={cat.name} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedNonMaterial(expandedNonMaterial === cat.name ? null : cat.name)}
                    className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-900">{cat.name}</span>
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {cat.count}
                      </span>
                    </div>
                    {expandedNonMaterial === cat.name ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                  </button>
                  {expandedNonMaterial === cat.name && cat.examples.length > 0 && (
                    <div className="px-3 pb-3 pt-0 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2">Example quotes:</p>
                      <ul className="space-y-1">
                        {cat.examples.slice(0, 2).map((example, i) => (
                          <li key={i} className="text-sm text-slate-600 italic">
                            "{example}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
