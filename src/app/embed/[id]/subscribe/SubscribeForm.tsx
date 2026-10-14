'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Mail } from 'lucide-react'

// Primary colour comes from the --embed-primary custom property set by EmbedFormShell.
const inputClass = 'w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[color:var(--embed-primary)] focus:border-[color:var(--embed-primary)] outline-none transition-all'
const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5'

export function SubscribeForm({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [gdprConsent, setGdprConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/embed/${projectId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name.trim() || undefined, gdprConsent }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Could not subscribe. Please try again.')
      }
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--embed-primary)' }} aria-hidden="true" />
        <h1 className="text-2xl font-semibold text-slate-900 mb-2">You’re subscribed</h1>
        <p className="text-slate-600">We’ll email you updates about {projectName}.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        Get updates about {projectName}
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className={labelClass}>Name</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClass}
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
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div className="flex items-start gap-3">
          <input
            id="gdprConsent"
            type="checkbox"
            checked={gdprConsent}
            onChange={e => setGdprConsent(e.target.checked)}
            className="mt-1 w-4 h-4 border-slate-300 rounded"
            style={{ accentColor: 'var(--embed-primary)' }}
            required
          />
          <label htmlFor="gdprConsent" className="text-sm text-slate-600">
            I agree to receive email updates about {projectName}. You can unsubscribe at any time. <span className="text-red-500">*</span>{' '}
            <a href="/privacy" target="_blank" className="underline hover:no-underline">
              Privacy policy
            </a>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !gdprConsent}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white rounded-lg hover:brightness-90 focus:ring-2 focus:ring-[color:var(--embed-primary)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ backgroundColor: 'var(--embed-primary)' }}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Subscribing...
            </>
          ) : (
            <>
              <Mail size={18} aria-hidden="true" />
              Subscribe
            </>
          )}
        </button>
      </form>
    </div>
  )
}
