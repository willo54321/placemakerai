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

export default function EnquiryFormPage({ params }: { params: { id: string } }) {
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
      const res = await fetch(`/api/embed/${params.id}/enquiries`, {
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
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            Enquiry Submitted
          </h1>
          <p className="text-slate-600 mb-4">
            Thank you for your enquiry. We will respond as soon as possible.
          </p>
          <p className="text-sm text-slate-500">
            Reference: <span className="font-mono">{reference}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            Submit an Enquiry
          </h1>
          <p className="text-slate-600">
            We'd love to hear from you. Fill out the form below and we'll get back to you.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                Your Name <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={form.submitterName}
                onChange={e => setForm({ ...form, submitterName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="John Smith"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                value={form.submitterEmail}
                onChange={e => setForm({ ...form, submitterEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                value={form.submitterPhone}
                onChange={e => setForm({ ...form, submitterPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="+44 7700 900000"
              />
            </div>

            <div>
              <label htmlFor="org" className="block text-sm font-medium text-slate-700 mb-1.5">
                Organization
              </label>
              <input
                id="org"
                type="text"
                value={form.submitterOrg}
                onChange={e => setForm({ ...form, submitterOrg: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                placeholder="Company or organization"
              />
            </div>
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1.5">
              Category
            </label>
            <select
              id="category"
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
            >
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1.5">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              id="subject"
              type="text"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
              placeholder="Brief summary of your enquiry"
              required
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1.5">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all min-h-[120px] resize-y"
              placeholder="Please provide details of your enquiry..."
              required
            />
          </div>

          {/* GDPR Consent */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-start gap-3">
              <input
                id="gdprConsent"
                type="checkbox"
                checked={form.gdprConsent}
                onChange={e => setForm({ ...form, gdprConsent: e.target.checked })}
                className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-600"
                required
              />
              <label htmlFor="gdprConsent" className="text-sm text-slate-600">
                I consent to my personal data being processed to respond to my enquiry. <span className="text-red-500">*</span>{' '}
                <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="mailingConsent"
                type="checkbox"
                checked={form.mailingConsent}
                onChange={e => setForm({ ...form, mailingConsent: e.target.checked })}
                className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-600"
              />
              <label htmlFor="mailingConsent" className="text-sm text-slate-600">
                I would like to receive updates about this consultation via email (optional)
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !form.gdprConsent}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Enquiry
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-4">
          Your information will be handled in accordance with our{' '}
          <a href="/privacy" target="_blank" className="text-blue-600 hover:underline">privacy policy</a>.
        </p>
      </div>
    </div>
  )
}
