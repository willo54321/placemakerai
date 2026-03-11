'use client'

import { useState } from 'react'
import { FileText, ExternalLink, Copy, Check, Code } from 'lucide-react'
import { FormsTab } from './forms'

interface Project {
  id: string
  name: string
  embedEnabled: boolean
  feedbackForms: any[]
}

export function FormsTabWrapper({ projectId, project }: { projectId: string; project: Project }) {
  const [copiedApi, setCopiedApi] = useState(false)

  const apiEndpoint = typeof window !== 'undefined'
    ? `${window.location.origin}/api/projects/${projectId}/feedback`
    : `/api/projects/${projectId}/feedback`

  const apiExample = `fetch('${apiEndpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Smith',
    email: 'john@example.com',
    // ... your form fields
    gdprConsent: true
  })
})`

  const copyApiEndpoint = () => {
    navigator.clipboard.writeText(apiEndpoint)
    setCopiedApi(true)
    setTimeout(() => setCopiedApi(false), 2000)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with API info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Form Submissions</h2>
              <p className="text-sm text-gray-600">
                Create forms in Placemaker or submit from external websites
              </p>
            </div>
          </div>
          {project.embedEnabled && (
            <button
              onClick={copyApiEndpoint}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-white rounded-lg border border-blue-200"
            >
              {copiedApi ? <Check size={14} /> : <Copy size={14} />}
              {copiedApi ? 'Copied!' : 'Copy API URL'}
            </button>
          )}
        </div>

        {project.embedEnabled && (
          <details className="mt-4">
            <summary className="text-sm text-blue-700 cursor-pointer hover:underline flex items-center gap-1">
              <Code size={14} /> Show API integration code
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">API Endpoint:</p>
                <code className="text-xs bg-gray-900 text-gray-100 px-2 py-1 rounded block overflow-x-auto">
                  POST {apiEndpoint}
                </code>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Example:</p>
                <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto">
                  <code>{apiExample}</code>
                </pre>
              </div>
              <p className="text-xs text-gray-500">
                Send any form fields as JSON. <code className="bg-gray-200 px-1 rounded">gdprConsent: true</code> is required.
                Responses appear in this tab automatically.
              </p>
            </div>
          </details>
        )}

        {!project.embedEnabled && (
          <p className="mt-3 text-sm text-amber-600">
            Enable embedding in Website settings to accept external form submissions.
          </p>
        )}
      </div>

      {/* Existing forms component */}
      <FormsTab projectId={projectId} forms={project.feedbackForms || []} />
    </div>
  )
}
