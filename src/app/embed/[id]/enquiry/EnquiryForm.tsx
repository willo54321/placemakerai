'use client'

import { useState } from 'react'
import { Send, CheckCircle, AlertCircle } from 'lucide-react'

const CATEGORIES = [
  { value: 'general', label: 'General Enquiry' },
  { value: 'planning', label: 'Planning Question' },
  { value: 'objection', label: 'Objection' },
  { value: 'support', label: 'Support' },
  { value: 'complaint', label: 'Complaint' },
]

// Primary colour comes from the --embed-primary custom property set by EmbedFormShell.
const inputClass = 'w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[color:var(--embed-primary)] focus:border-[color:var(--embed-primary)] outline-none transition-all'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

export function EnquiryForm({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [form, setForm] = useState({
    submitterName: '',
    submitterEmail: '',
    submitterPhone: '',
    submitterOrg: '',
    subject: '',
    message: '',
    category: 'general',
    gdprConsent: false,
    mailingConsent: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/embed/${projectId}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit enquiry')
      }

      setSubmitted(true)
      setReference(data.reference)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-10 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--embed-primary)' }} aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">
          Enquiry submitted
        </h1>
        <p className="text-slate-600 mb-4">
          Thank you for your enquiry. We will respond as soon as possible.
        </p>
        <p className="text-sm text-slate-500">
          Reference: <span className="font-mono">{reference}</span>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        Submit an enquiry
      </h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              Your name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={form.submitterName}
              onChange={e => setForm({ ...form, submitterName: e.target.value })}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={form.submitterEmail}
              onChange={e => setForm({ ...form, submitterEmail: e.target.value })}
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone number
            </label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={form.submitterPhone}
              onChange={e => setForm({ ...form, submitterPhone: e.target.value })}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="org" className={labelClass}>
              Organisation
            </label>
            <input
              id="org"
              type="text"
              autoComplete="organization"
              value={form.submitterOrg}
              onChange={e => setForm({ ...form, submitterOrg: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="category" className={labelClass}>
            Category
          </label>
          <select
            id="category"
            value={form.category}
            onChange={e => setForm({ ...form, category: e.target.value })}
            className={inputClass}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="subject" className={labelClass}>
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            id="subject"
            type="text"
            value={form.subject}
            onChange={e => setForm({ ...form, subject: e.target.value })}
            className={inputClass}
            required
          />
        </div>

        <div>
          <label htmlFor="message" className={labelClass}>
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            className={`${inputClass} min-h-[120px] resize-y`}
            required
          />
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-200">
          <div className="flex items-start gap-3">
            <input
              id="gdprConsent"
              type="checkbox"
              checked={form.gdprConsent}
              onChange={e => setForm({ ...form, gdprConsent: e.target.checked })}
              className="mt-1 w-4 h-4 border-slate-300 rounded"
              style={{ accentColor: 'var(--embed-primary)' }}
              required
            />
            <label htmlFor="gdprConsent" className="text-sm text-slate-600">
              I consent to my personal data being processed to respond to my enquiry. <span className="text-red-500">*</span>{' '}
              <a href="/privacy" target="_blank" className="underline hover:no-underline">
                Privacy policy
              </a>
            </label>
          </div>
          <div className="flex items-start gap-3">
            <input
              id="mailingConsent"
              type="checkbox"
              checked={form.mailingConsent}
              onChange={e => setForm({ ...form, mailingConsent: e.target.checked })}
              className="mt-1 w-4 h-4 border-slate-300 rounded"
              style={{ accentColor: 'var(--embed-primary)' }}
            />
            <label htmlFor="mailingConsent" className="text-sm text-slate-600">
              Email me updates about {projectName}. You can unsubscribe at any time.
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !form.gdprConsent}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white rounded-lg hover:brightness-90 focus:ring-2 focus:ring-[color:var(--embed-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ backgroundColor: 'var(--embed-primary)' }}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send size={18} aria-hidden="true" />
              Submit enquiry
            </>
          )}
        </button>
      </form>
    </div>
  )
}
