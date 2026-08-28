'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { fetchJson } from '@/lib/fetch-json'

export default function PublicFormPage({ params }: { params: { id: string } }) {
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
    mutationFn: (payload: { data: Record<string, any>; gdprConsent: boolean }) =>
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

  const fieldKey = (field: any) => field.id ?? field.label

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gdprConsent) return

    const errors: Record<string, string> = {}

    for (const field of (form.fields || [])) {
      const key = fieldKey(field)
      const value = formData[key]

      // Required-field enforcement for rating and checkbox groups (native
      // `required` doesn't cover these custom controls).
      if (field.required) {
        if (field.type === 'rating' && (value === undefined || value === null || value === '')) {
          errors[key] = 'Please select a rating.'
        } else if (field.type === 'checkbox' && (!Array.isArray(value) || value.length === 0)) {
          errors[key] = 'Please select at least one option.'
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
    submitResponse.mutate({ data: formData, gdprConsent })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">{form.name}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields?.map((field: any, i: number) => {
            const key = fieldKey(field)
            const fieldError = validationErrors[key]
            return (
            <div key={i}>
              <label className="block text-sm font-medium mb-2">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>

              {field.type === 'textarea' ? (
                <textarea
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full p-2 border rounded"
                  rows={3}
                />
              ) : field.type === 'select' ? (
                <select
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select...</option>
                  {field.options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === 'radio' ? (
                <div className="space-y-2">
                  {field.options?.map((o: string) => (
                    <label key={o} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={key}
                        value={o}
                        required={field.required}
                        checked={formData[key] === o}
                        onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : field.type === 'checkbox' ? (
                <div className={`space-y-2 ${fieldError ? 'rounded border border-red-500 p-2' : ''}`}>
                  {field.options?.map((o: string) => (
                    <label key={o} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(formData[key] || []).includes(o)}
                        onChange={e => {
                          const current = formData[key] || []
                          setFormData({
                            ...formData,
                            [key]: e.target.checked
                              ? [...current, o]
                              : current.filter((v: string) => v !== o),
                          })
                        }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : field.type === 'rating' ? (
                <div className={`flex gap-2 ${fieldError ? 'rounded border border-red-500 p-2' : ''}`}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      className={`w-10 h-10 border rounded ${formData[key] === n ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}
                      onClick={() => setFormData({ ...formData, [key]: n })}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={field.type}
                  required={field.required}
                  value={formData[key] || ''}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
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
