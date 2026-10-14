'use client'

import { useState } from 'react'
import { Check, Code, Copy } from 'lucide-react'

export interface EndpointField {
  name: string
  required?: boolean
  description: string
}

// Integration details for a public submission endpoint, for the client's web
// developer to post their own website form into Placemaker.
export function ApiEndpointPanel({
  title,
  path,
  fields,
  example,
  embedEnabled,
}: {
  title: string
  /** Path after the origin, e.g. `/api/embed/{id}/enquiries`. */
  path: string
  fields: EndpointField[]
  /** Example JSON body (pretty-printed into the snippet). */
  example: Record<string, unknown>
  embedEnabled: boolean
}) {
  const [copied, setCopied] = useState<'url' | 'code' | null>(null)

  const endpoint = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  const body = JSON.stringify(example, null, 2).replace(/\n/g, '\n  ')
  const code = `fetch('${endpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(${body}),
})
  .then(res => res.json())
  .then(data => {
    // 200: { success: true, reference } · 400: { error } naming each problem field
  })`

  const copy = (what: 'url' | 'code') => {
    navigator.clipboard.writeText(what === 'url' ? endpoint : code)
    setCopied(what)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Code size={16} className="text-slate-500" aria-hidden="true" />
          {title}
        </h3>
        {embedEnabled ? (
          <div className="flex gap-2">
            <button onClick={() => copy('url')} className="btn-secondary flex items-center gap-1.5 text-sm">
              {copied === 'url' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === 'url' ? 'Copied!' : 'Copy endpoint'}
            </button>
            <button onClick={() => copy('code')} className="btn-secondary flex items-center gap-1.5 text-sm">
              {copied === 'code' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === 'code' ? 'Copied!' : 'Copy example code'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Turn on embedding in Website settings to accept submissions.</p>
        )}
      </div>
      {embedEnabled && (
        <details className="mt-3">
          <summary className="text-sm text-slate-600 cursor-pointer hover:underline">Show integration details</summary>
          <div className="mt-3 space-y-3">
            <code className="text-xs bg-slate-900 text-slate-100 px-3 py-2 rounded-lg block overflow-x-auto">
              POST {endpoint}
            </code>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 pr-3 font-medium">Field</th>
                  <th className="py-1 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fields.map(f => (
                  <tr key={f.name}>
                    <td className="py-1.5 pr-3 align-top whitespace-nowrap">
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{f.name}</code>
                      {f.required && <span className="ml-1 text-xs text-red-600">required</span>}
                    </td>
                    <td className="py-1.5 text-slate-600">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded-lg overflow-x-auto">
              <code>{code}</code>
            </pre>
            <p className="text-xs text-slate-500">
              JSON body, callable from any website (CORS enabled). Unknown fields are rejected. Limited to 5 submissions per minute per visitor.
            </p>
          </div>
        </details>
      )}
    </div>
  )
}
