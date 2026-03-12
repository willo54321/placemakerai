'use client'

import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Plus, Trash2, X, Eye, Copy, FileText, Check, GripVertical, List, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { usePermissions } from '@/hooks/usePermissions'

interface FeedbackResponse {
  id: string
  data: Record<string, any>
  submittedAt: string
}

interface FeedbackForm {
  id: string
  name: string
  fields: any[]
  active: boolean
  _count: { responses: number }
  responses?: FeedbackResponse[]
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'rating', label: 'Rating (1-5)' },
]

export function FormsTab({ projectId, forms }: { projectId: string; forms: FeedbackForm[] }) {
  const queryClient = useQueryClient()
  const { canManageForms } = usePermissions()
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [fields, setFields] = useState<any[]>([])
  const [viewingForm, setViewingForm] = useState<FeedbackForm | null>(null)
  const [viewingResponses, setViewingResponses] = useState<string | null>(null)
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Fetch responses when viewing a form's responses
  const { data: responsesData, isLoading: loadingResponses } = useQuery({
    queryKey: ['form-responses', viewingResponses],
    queryFn: () => fetch(`/api/projects/${projectId}/forms/${viewingResponses}`).then(r => r.json()),
    enabled: !!viewingResponses,
  })

  // Focus name input when form opens
  useEffect(() => {
    if (showForm && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showForm])

  const createForm = useMutation({
    mutationFn: (data: { name: string; fields: any[] }) =>
      fetch(`/api/projects/${projectId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setShowForm(false)
      setFormName('')
      setFields([])
    },
  })

  const deleteForm = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/projects/${projectId}/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setDeleteConfirm(null)
    },
  })

  const addField = () => {
    setFields([...fields, { id: Date.now(), type: 'text', label: '', required: false, options: [] }])
  }

  const updateField = (id: number, updates: any) => {
    setFields(fields.map(f => (f.id === id ? { ...f, ...updates } : f)))
  }

  const removeField = (id: number) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const copyFormLink = (formId: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/forms/${formId}`)
    setCopiedId(formId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formName && fields.length > 0) {
      createForm.mutate({ name: formName, fields })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Feedback Forms</h2>
          <p className="text-sm text-slate-600">Create and manage feedback collection forms</p>
        </div>
        {canManageForms && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
            aria-haspopup="dialog"
          >
            <Plus size={18} aria-hidden="true" />
            Create Form
          </button>
        )}
      </div>

      {/* Create form modal */}
      {showForm && (
        <>
          <div
            className="modal-overlay"
            onClick={() => setShowForm(false)}
            aria-hidden="true"
          />
          <div
            className="modal"
            role="dialog"
            aria-labelledby="create-form-title"
            aria-modal="true"
          >
            <div className="modal-content p-6 max-w-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 id="create-form-title" className="text-lg font-semibold text-slate-900">
                  Create Feedback Form
                </h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="btn-icon"
                  aria-label="Close dialog"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="mb-6">
                  <label htmlFor="form-name" className="label label-required">
                    Form Name
                  </label>
                  <input
                    ref={nameInputRef}
                    id="form-name"
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="input"
                    placeholder="e.g., Project Feedback Survey"
                    required
                    aria-required="true"
                  />
                </div>

                {/* Fields */}
                <div className="mb-4">
                  <label className="label">Form Fields</label>
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="card p-4 bg-slate-50 border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <GripVertical size={16} className="text-slate-400" aria-hidden="true" />
                            <span className="text-sm font-medium text-slate-600">Field {index + 1}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeField(field.id)}
                            className="btn-icon hover:text-red-600"
                            aria-label={`Remove field ${index + 1}`}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label htmlFor={`field-label-${field.id}`} className="sr-only">
                              Field label
                            </label>
                            <input
                              id={`field-label-${field.id}`}
                              type="text"
                              placeholder="Field label"
                              value={field.label}
                              onChange={e => updateField(field.id, { label: e.target.value })}
                              className="input"
                            />
                          </div>
                          <div>
                            <label htmlFor={`field-type-${field.id}`} className="sr-only">
                              Field type
                            </label>
                            <select
                              id={`field-type-${field.id}`}
                              value={field.type}
                              onChange={e => updateField(field.id, { type: e.target.value })}
                              className="input"
                            >
                              {FIELD_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center">
                            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.required}
                                onChange={e => updateField(field.id, { required: e.target.checked })}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                              Required field
                            </label>
                          </div>
                        </div>
                        {['select', 'radio', 'checkbox'].includes(field.type) && (
                          <div className="mt-3">
                            <label htmlFor={`field-options-${field.id}`} className="sr-only">
                              Options
                            </label>
                            <input
                              id={`field-options-${field.id}`}
                              type="text"
                              placeholder="Options (comma separated)"
                              value={field.options?.join(', ') || ''}
                              onChange={e => updateField(field.id, { options: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                              className="input"
                            />
                            <p className="helper-text">Enter options separated by commas</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addField}
                  className="w-full p-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors mb-6"
                >
                  <Plus size={18} className="inline mr-2" aria-hidden="true" />
                  Add Field
                </button>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formName || fields.length === 0 || createForm.isPending}
                    className="btn-primary"
                  >
                    {createForm.isPending ? (
                      <>
                        <span className="spinner" aria-hidden="true" />
                        Creating...
                      </>
                    ) : (
                      'Create Form'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {forms.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-slate-400" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No forms yet</h3>
          <p className="text-slate-600 mb-6 max-w-sm mx-auto">
            Create feedback forms to collect responses from stakeholders and community members.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            <Plus size={18} aria-hidden="true" />
            Create First Form
          </button>
        </div>
      ) : (
        /* Forms grid */
        <div className="grid gap-4 md:grid-cols-2" role="list">
          {forms.map(form => (
            <article key={form.id} className="card-hover p-5" role="listitem">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-slate-900">{form.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {form.fields?.length || 0} fields · {form._count?.responses || 0} responses
                  </p>
                </div>
                <span className={form.active ? 'badge-green' : 'badge-gray'}>
                  {form.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                {(form._count?.responses || 0) > 0 && (
                  <button
                    onClick={() => setViewingResponses(form.id)}
                    className="btn-ghost text-sm py-1.5 text-blue-600"
                    aria-label={`View responses for ${form.name}`}
                  >
                    <List size={16} aria-hidden="true" />
                    Responses
                  </button>
                )}
                <button
                  onClick={() => setViewingForm(form)}
                  className="btn-ghost text-sm py-1.5"
                  aria-label={`Preview ${form.name}`}
                >
                  <Eye size={16} aria-hidden="true" />
                  Preview
                </button>
                <button
                  onClick={() => copyFormLink(form.id)}
                  className="btn-ghost text-sm py-1.5"
                  aria-label={`Copy link for ${form.name}`}
                >
                  {copiedId === form.id ? (
                    <>
                      <Check size={16} className="text-green-600" aria-hidden="true" />
                      <span className="text-green-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} aria-hidden="true" />
                      Copy Link
                    </>
                  )}
                </button>
                <div className="ml-auto">
                  {deleteConfirm === form.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteForm.mutate(form.id)}
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        aria-label={`Confirm delete ${form.name}`}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                        aria-label="Cancel delete"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(form.id)}
                      className="btn-icon hover:text-red-600"
                      aria-label={`Delete ${form.name}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Form Preview Modal */}
      {viewingForm && (
        <>
          <div
            className="modal-overlay"
            onClick={() => setViewingForm(null)}
            aria-hidden="true"
          />
          <div
            className="modal"
            role="dialog"
            aria-labelledby="preview-form-title"
            aria-modal="true"
          >
            <div className="modal-content p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 id="preview-form-title" className="text-lg font-semibold text-slate-900">
                  {viewingForm.name}
                </h3>
                <button
                  onClick={() => setViewingForm(null)}
                  className="btn-icon"
                  aria-label="Close preview"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <p className="text-sm text-slate-500 mb-4">Form preview (disabled)</p>

              <div className="space-y-4">
                {viewingForm.fields?.map((field: any, i: number) => (
                  <div key={i}>
                    <label className="label">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea className="input" rows={3} disabled aria-disabled="true" />
                    ) : field.type === 'select' ? (
                      <select className="input" disabled aria-disabled="true">
                        <option>Select an option...</option>
                        {field.options?.map((o: string) => <option key={o}>{o}</option>)}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div className="space-y-2" role="radiogroup" aria-label={field.label}>
                        {field.options?.map((o: string) => (
                          <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="radio"
                              disabled
                              className="w-4 h-4 border-slate-300 text-blue-600"
                              aria-disabled="true"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="space-y-2" role="group" aria-label={field.label}>
                        {field.options?.map((o: string) => (
                          <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              disabled
                              className="w-4 h-4 rounded border-slate-300 text-blue-600"
                              aria-disabled="true"
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'rating' ? (
                      <div className="flex gap-2" role="radiogroup" aria-label={`${field.label} rating`}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button
                            key={n}
                            className="w-10 h-10 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed"
                            disabled
                            aria-disabled="true"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input type={field.type} className="input" disabled aria-disabled="true" />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                <button
                  onClick={() => copyFormLink(viewingForm.id)}
                  className="btn-secondary"
                >
                  <Copy size={16} aria-hidden="true" />
                  Copy Link
                </button>
                <button
                  onClick={() => setViewingForm(null)}
                  className="btn-primary"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* View Responses Modal */}
      {viewingResponses && (
        <>
          <div
            className="modal-overlay"
            onClick={() => {
              setViewingResponses(null)
              setExpandedResponse(null)
            }}
            aria-hidden="true"
          />
          <div
            className="modal"
            role="dialog"
            aria-labelledby="responses-title"
            aria-modal="true"
          >
            <div className="modal-content p-0 max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <List size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 id="responses-title" className="text-lg font-semibold text-slate-900">
                        Form Responses
                      </h3>
                      <p className="text-sm text-slate-500">
                        {responsesData?.responses?.length || 0} submissions received
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setViewingResponses(null)
                      setExpandedResponse(null)
                    }}
                    className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                    aria-label="Close responses"
                  >
                    <X size={20} className="text-slate-500" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-6 bg-slate-50">
                {loadingResponses ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-slate-600">Loading responses...</span>
                  </div>
                ) : responsesData?.responses?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                      <FileText size={28} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium">No responses yet</p>
                    <p className="text-sm text-slate-400 mt-1">Responses will appear here when submitted</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {responsesData?.responses?.map((response: FeedbackResponse, index: number) => {
                      const name = response.data.name || response.data.Name || response.data.fullName || response.data.full_name
                      const email = response.data.email || response.data.Email || response.data.emailAddress
                      const isExpanded = expandedResponse === response.id

                      // Build a map of data keys to form field labels
                      const formFields = responsesData?.fields || []
                      const fieldLabelMap: Record<string, string> = {}
                      formFields.forEach((field: any) => {
                        if (field.label) {
                          // Map the label itself (for forms created in Placemaker)
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
                              {name ? name.charAt(0).toUpperCase() : `#${responsesData.responses.length - index}`}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* Name & Email row */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {name ? (
                                  <span className="font-semibold text-slate-900">{name}</span>
                                ) : (
                                  <span className="font-medium text-slate-600">Response #{responsesData.responses.length - index}</span>
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
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
                <button
                  onClick={() => {
                    setViewingResponses(null)
                    setExpandedResponse(null)
                  }}
                  className="btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
