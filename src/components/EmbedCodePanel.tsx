'use client'

import { useState } from 'react'
import { Check, Code, Copy, ExternalLink } from 'lucide-react'

// Copy-paste iframe snippet for a standalone embed page (/embed/{id}/{path}).
export function EmbedCodePanel({
  projectId,
  path,
  title,
  height,
  embedEnabled,
}: {
  projectId: string
  path: 'enquiry' | 'subscribe'
  title: string
  height: number
  embedEnabled: boolean
}) {
  const [copied, setCopied] = useState(false)

  const embedUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/embed/${projectId}/${path}`
    : `/embed/${projectId}/${path}`
  const embedCode = `<iframe
  src="${embedUrl}"
  width="100%"
  height="${height}"
  frameborder="0"
  title="${title}"
  style="border: 0;"
></iframe>`

  const copy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Code size={16} className="text-slate-500" aria-hidden="true" />
          {title} embed
        </h3>
        {embedEnabled ? (
          <div className="flex gap-2">
            <a href={embedUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary flex items-center gap-1.5 text-sm">
              <ExternalLink size={14} aria-hidden="true" /> Preview
            </a>
            <button onClick={copy} className="btn-secondary flex items-center gap-1.5 text-sm">
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? 'Copied!' : 'Copy embed code'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Turn on embedding in Website settings to accept submissions.</p>
        )}
      </div>
      {embedEnabled && (
        <details className="mt-3">
          <summary className="text-sm text-slate-600 cursor-pointer hover:underline">Show embed code</summary>
          <pre className="mt-2 bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
            <code>{embedCode}</code>
          </pre>
        </details>
      )}
    </div>
  )
}
