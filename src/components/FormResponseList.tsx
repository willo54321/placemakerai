'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { answerFields } from '@/lib/form-fields'

export interface NumberedResponse {
  id: string
  data: Record<string, any>
  submittedAt: string
  /** Stable submission-order number: the first ever response is #1. */
  responseNumber: number
}

/** A form's responses as expandable cards, with delete. */
export function FormResponseList({
  projectId, formId, fields, responses, focusResponseId,
}: {
  projectId: string
  formId: string
  fields: any[]
  responses: NumberedResponse[]
  /** Expand and scroll to this response (deep links from the activity feed). */
  focusResponseId?: string | null
}) {
  const queryClient = useQueryClient()
  const [expandedResponse, setExpandedResponse] = useState<string | null>(focusResponseId ?? null)

  useEffect(() => {
    if (!focusResponseId) return
    const timer = setTimeout(() => {
      document.getElementById(`response-${focusResponseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    return () => clearTimeout(timer)
  }, [focusResponseId])

  const deleteResponse = useMutation({
    mutationFn: async (responseId: string) => {
      const res = await fetch(`/api/projects/${projectId}/forms/${formId}/responses/${responseId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-responses', formId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setExpandedResponse(null)
      toast.success('Response permanently deleted')
    },
    onError: () => {
      toast.error('Failed to delete — the response is unchanged')
    },
  })

  if (responses.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-12">No responses match these filters.</p>
  }

  return (
    <div className="space-y-4">
    {responses.map((response) => {
      const name = response.data.name || response.data.Name || response.data.fullName || response.data.full_name
      const email = response.data.email || response.data.Email || response.data.emailAddress
      const isExpanded = expandedResponse === response.id

      // Build a map of data keys to form field labels
      const formFields = answerFields(fields)
      const fieldLabelMap: Record<string, string> = {}
      formFields.forEach((field: any) => {
        if (field.label) {
          // Placemaker forms key answers by field id; external forms by label
          if (field.id != null) fieldLabelMap[String(field.id)] = field.label
          fieldLabelMap[field.label] = field.label
          // Also map common key formats that external forms might use
          const camelCase = field.label.replace(/[^a-zA-Z0-9]+(.)/g, (_: any, chr: string) => chr.toUpperCase()).replace(/^(.)/, (chr: string) => chr.toLowerCase())
          const snakeCase = field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')
          const pascalCase = field.label.replace(/[^a-zA-Z0-9]+(.)/g, (_: any, chr: string) => chr.toUpperCase()).replace(/^(.)/, (chr: string) => chr.toUpperCase())
          fieldLabelMap[camelCase] = field.label
          fieldLabelMap[snakeCase] = field.label
          fieldLabelMap[pascalCase] = field.label
        }
      })

      // Helper to get display label for a key
      const getDisplayLabel = (key: string): string => {
        if (fieldLabelMap[key]) return fieldLabelMap[key]
        // Fallback: format the key nicely
        return key
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim()
      }

      // Get preview fields (excluding name, email, and consent fields)
      const excludeKeys = ['name', 'Name', 'fullName', 'full_name', 'email', 'Email', 'emailAddress', 'gdprConsent', 'consent', 'dataConsent']
      const previewEntries = Object.entries(response.data)
        .filter(([key]) => !excludeKeys.includes(key))
        .slice(0, 2)

      return (
        <div
          key={response.id}
          id={`response-${response.id}`}
          className={`bg-white rounded-xl border transition-all duration-200 ${
            isExpanded ? 'border-blue-200 shadow-md ring-1 ring-blue-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
          }`}
        >
          <button
            onClick={() => setExpandedResponse(isExpanded ? null : response.id)}
            className="w-full p-4 flex items-start gap-4 text-left"
          >
            {/* Avatar / Number */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${
              isExpanded ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {name ? name.charAt(0).toUpperCase() : `#${response.responseNumber}`}
            </div>

            <div className="flex-1 min-w-0">
              {/* Name & Email row */}
              <div className="flex items-center gap-2 flex-wrap">
                {name ? (
                  <span className="font-semibold text-slate-900">{name}</span>
                ) : (
                  <span className="font-medium text-slate-600">Response #{response.responseNumber}</span>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    onClick={e => e.stopPropagation()}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {email}
                  </a>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-slate-400 mt-0.5">
                {new Date(response.submittedAt).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>

              {/* Preview of first fields (when collapsed) */}
              {!isExpanded && previewEntries.length > 0 && (
                <p className="text-sm text-slate-500 mt-2 line-clamp-1">
                  {previewEntries.map(([key, value], i) => (
                    <span key={key}>
                      {i > 0 && ' · '}
                      <span className="text-slate-400">{getDisplayLabel(key)}:</span>{' '}
                      {Array.isArray(value) ? value.join(', ') : String(value).substring(0, 50)}
                    </span>
                  ))}
                </p>
              )}
            </div>

            <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-100' : 'bg-slate-100'}`}>
              {isExpanded ? (
                <ChevronUp size={18} className="text-blue-600" />
              ) : (
                <ChevronDown size={18} className="text-slate-400" />
              )}
            </div>
          </button>

          {/* Expanded content */}
          {isExpanded && (
            <div className="px-4 pb-4 pt-0">
              <div className="border-t border-slate-100 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(response.data)
                    .filter(([key]) => !['gdprConsent', 'consent', 'dataConsent'].includes(key))
                    .map(([key, value]) => {
                      const isLongText = typeof value === 'string' && value.length > 100
                      const displayLabel = getDisplayLabel(key)
                      return (
                        <div
                          key={key}
                          className={`${isLongText ? 'sm:col-span-2' : ''}`}
                        >
                          <dt className="text-sm font-medium text-slate-600 mb-1">
                            {displayLabel}
                          </dt>
                          <dd className={`text-sm text-slate-900 ${isLongText ? 'whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100' : ''}`}>
                            {Array.isArray(value) ? (
                              <div className="flex flex-wrap gap-1">
                                {value.map((v, i) => (
                                  <span key={i} className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                                    {v}
                                  </span>
                                ))}
                              </div>
                            ) : typeof value === 'boolean' ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {value ? 'Yes' : 'No'}
                              </span>
                            ) : (
                              String(value) || <span className="text-slate-400 italic">Not provided</span>
                            )}
                          </dd>
                        </div>
                      )
                    })}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => {
                      if (confirm('Permanently delete this response?\n\nIt will be removed from exports and from the next AI analysis run. This cannot be undone.')) {
                        deleteResponse.mutate(response.id)
                      }
                    }}
                    disabled={deleteResponse.isPending}
                    className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete response
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    })}
    </div>
  )
}
