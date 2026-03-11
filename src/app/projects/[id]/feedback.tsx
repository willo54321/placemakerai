'use client'

import { useState } from 'react'
import { MapPin, MessageCircle, ExternalLink, Copy, Check } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamic imports for map components to avoid SSR/chunk loading issues
const MapTab = dynamic(
  () => import('./map').then(mod => ({ default: mod.MapTab })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Loading map...</span>
        </div>
      </div>
    )
  }
)

const FeedbackPinsTab = dynamic(
  () => import('./feedback-pins').then(mod => ({ default: mod.FeedbackPinsTab })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500">Loading responses...</span>
        </div>
      </div>
    )
  }
)

type SubTab = 'map' | 'responses'

export function FeedbackTab({ projectId, project }: { projectId: string; project: any }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('map')
  const [copiedCode, setCopiedCode] = useState(false)

  // Count only feedback pins (not issues)
  const feedbackPinCount = project.publicPins?.filter((p: any) => (p.mode || 'feedback') === 'feedback').length || 0

  const subTabs = [
    {
      id: 'map' as SubTab,
      label: 'Map Editor',
      icon: MapPin,
      count: project.mapMarkers?.length || 0,
    },
    {
      id: 'responses' as SubTab,
      label: 'Responses',
      icon: MessageCircle,
      count: feedbackPinCount,
    },
  ]

  const embedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}`
    : `/embed/${projectId}`

  const embedCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="600"
  frameborder="0"
  allow="geolocation"
  style="border: 1px solid #e5e7eb; border-radius: 8px;"
></iframe>`

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with embed info */}
      {project.embedEnabled && (
        <div className="bg-green-50 border-b border-green-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-700">
              <strong>Map feedback is live</strong> — visitors can drop pins and leave comments
            </p>
            <div className="flex gap-2">
              <a
                href={embedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 bg-white rounded border border-green-200"
              >
                <ExternalLink size={12} /> Preview
              </a>
              <button
                onClick={copyEmbedCode}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 px-2 py-1 bg-white rounded border border-green-200"
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                {copiedCode ? 'Copied!' : 'Embed Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab navigation */}
      <div className="border-b border-slate-200 bg-white px-6">
        <nav className="flex gap-1" aria-label="Feedback sections">
          {subTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === tab.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <tab.icon size={16} aria-hidden="true" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeSubTab === tab.id
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-auto">
        {activeSubTab === 'map' && (
          <MapTab projectId={projectId} project={project} />
        )}
        {activeSubTab === 'responses' && (
          <div className="p-6">
            <FeedbackPinsTab projectId={projectId} project={project} />
          </div>
        )}
      </div>
    </div>
  )
}
