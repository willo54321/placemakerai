'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useState, use } from 'react';
import { fetchJson } from '@/lib/fetch-json'
import { fieldKey, matrixRowKey, specifyKey, type FormFieldDef } from '@/lib/form-fields'

export default function PublicFormPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [gdprConsent, setGdprConsent] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const { data: form, isLoading, isError } = useQuery({
    queryKey: ['form', params.id],
    queryFn: () => fetchJson(`/api/forms/${params.id}`),
    retry: false,
  })

  const submitResponse = useMutation({
    mutationFn: (payload: { data: Record<string, any>; gdprConsent: boolean; mailingConsent: boolean }) =>
      fetchJson(`/api/forms/${params.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setSubmitError(null)
      setSubmitted(true)
    },
    onError: (err: unknown) => {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong submitting your feedback. Please try again.'
      )
    },
  })

  if (isLoading) return <div className="p-8 text-center">Loading...</div>
  if (isError || !form) return <div className="p-8 text-center">Form not found</div>

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow text-center max-w-md">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <h1 className="text-xl font-bold mb-2">Thank you!</h1>
          <p className="text-gray-600">Your feedback has been submitted successfully.</p>
        </div>
      </div>
    )
  }

  const fields: FormFieldDef[] = form.fields || []
  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  const setValue = (key: string, value: unknown) => setFormData(d => ({ ...d, [key]: value }))

  /** The chosen option(s) of a choice field, as a list. */
  const chosen = (field: FormFieldDef): string[] => {
    const v = formData[fieldKey(field)]
    return Array.isArray(v) ? v : v ? [v] : []
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gdprConsent) return

    const errors: Record<string, string> = {}

    for (const field of fields) {
      const key = fieldKey(field)
      const value = formData[key]

      // Required-field enforcement for custom controls (native `required`
      // doesn't cover these).
      if (field.required) {
        if (field.type === 'rating' && (value === undefined || value === null || value === '')) {
          errors[key] = 'Please select a rating.'
        } else if (field.type === 'checkbox' && (!Array.isArray(value) || value.length === 0)) {
          errors[key] = 'Please select at least one option.'
        } else if (field.type === 'matrix' && (field.rows ?? []).some((_, i) => !formData[matrixRowKey(field, i)])) {
          errors[key] = 'Please answer every row.'
        }
      }

      // An option that asks for details needs them.
      for (const option of field.specify ?? []) {
        if (chosen(field).includes(option) && !String(formData[specifyKey(field, option)] ?? '').trim()) {
          errors[specifyKey(field, option)] = 'Please give details.'
        }
      }

      // Email-format validation for any email field.
      if (field.type === 'email' && typeof value === 'string' && value.trim() && !isValidEmail(value.trim())) {
        errors[key] = 'Please enter a valid email address.'
      }
    }

    // Top-level email, if the form captures one directly.
    if (typeof formData.email === 'string' && formData.email.trim() && !isValidEmail(formData.email.trim())) {
      errors.email = 'Please enter a valid email address.'
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors({})
    setSubmitError(null)
    const mailingConsent = fields.some(f => f.type === 'subscribe' && formData[fieldKey(f)] === true)
    submitResponse.mutate({ data: formData, gdprConsent, mailingConsent })
  }

  const specifyInput = (field: FormFieldDef, option: string) => {
    const key = specifyKey(field, option)
    const error = validationErrors[key]
    return (
      <div className="ml-6 mt-1">
        <input
          type="text"
          aria-label={`${option} — details`}
          placeholder="Please specify"
          value={formData[key] || ''}
          onChange={e => setValue(key, e.target.value)}
          className={`w-full p-2 border rounded text-sm ${error ? 'border-red-500' : ''}`}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6 sm:p-8">
        <h1 className="text-2xl font-bold mb-6">{form.name}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {fields.map((field, i) => {
            const key = fieldKey(field)
            const fieldError = validationErrors[key]

            if (field.type === 'heading') {
              return (
                <div key={i} className={i > 0 ? 'pt-6 border-t border-gray-200' : ''}>
                  {field.label && <h2 className="text-lg font-semibold">{field.label}</h2>}
                  {field.description && (
                    <p className={`text-sm text-gray-600 whitespace-pre-line ${field.label ? 'mt-2' : ''}`}>{field.description}</p>
                  )}
                </div>
              )
            }

            return (
            <div key={i}>
              {field.type !== 'subscribe' && (
                <label className="block text-sm font-medium mb-1">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
              )}
              {field.description && (
                <p className="text-sm text-gray-500 whitespace-pre-line mb-2">{field.description}</p>
              )}

              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setValue(key, e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={4}
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setValue(key, e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select...</option>
                  {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === 'radio' ? (
                <div className="space-y-2">
                  {field.options?.map((o: string) => (
                    <div key={o}>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={key}
                          value={o}
                          required={field.required}
                          checked={formData[key] === o}
                          onChange={e => setValue(key, e.target.value)}
                        />
                        {o}
                      </label>
                      {field.specify?.includes(o) && formData[key] === o && specifyInput(field, o)}
                    </div>
                  ))}
                </div>
              ) : field.type === 'checkbox' ? (
                <div className={`space-y-2 ${fieldError ? 'rounded border border-red-500 p-2' : ''}`}>
                  {field.options?.map((o: string) => {
                    const current: string[] = formData[key] || []
                    return (
                      <div key={o}>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={current.includes(o)}
                            onChange={e => setValue(key, e.target.checked ? [...current, o] : current.filter(v => v !== o))}
                          />
                          {o}
                        </label>
                        {field.specify?.includes(o) && current.includes(o) && specifyInput(field, o)}
                      </div>
                    )
                  })}
                </div>
              ) : field.type === 'matrix' ? (
                <div className={`space-y-3 ${fieldError ? 'rounded border border-red-500 p-2' : ''}`}>
                  {field.rows?.map((row, r) => {
                    const rowKey = matrixRowKey(field, r)
                    return (
                      <fieldset key={r} className="border border-gray-200 rounded p-3">
                        <legend className="text-sm px-1">{row}</legend>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                          {field.options?.map(o => (
                            <label key={o} className="flex items-center gap-1.5 text-sm">
                              <input
                                type="radio"
                                name={rowKey}
                                value={o}
                                checked={formData[rowKey] === o}
                                onChange={e => setValue(rowKey, e.target.value)}
                              />
                              {o}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    )
                  })}
                </div>
              ) : field.type === 'rating' ? (
                <div className={`flex gap-2 ${fieldError ? 'rounded border border-red-500 p-2' : ''}`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`w-10 h-10 border rounded ${formData[key] === n ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                      onClick={() => setValue(key, n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : field.type === 'subscribe' ? (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={formData[key] === true}
                    onChange={e => setValue(key, e.target.checked)}
                  />
                  {field.options?.[0] || 'I would like to receive updates about this project.'}
                </label>
              ) : (
                <input
                  type={field.type}
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setValue(key, e.target.value)}
                  className={`w-full p-2 border rounded ${fieldError ? 'border-red-500' : ''}`}
                />
              )}

              {fieldError && <p className="mt-1 text-sm text-red-600">{fieldError}</p>}
            </div>
            )
          })}

          {/* GDPR Consent */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <input
                id="gdprConsent"
                type="checkbox"
                checked={gdprConsent}
                onChange={e => setGdprConsent(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
                required
              />
              <label htmlFor="gdprConsent" className="text-sm text-gray-600">
                I consent to my data being processed to respond to my feedback. <span className="text-red-500">*</span>{' '}
                <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>

          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitResponse.isPending || !gdprConsent}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {submitResponse.isPending ? 'Submitting...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  )
}
