'use client'

import { useState, useEffect } from 'react'
import { Send, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

interface QueryData {
  id: string
  question: string
  status: string
  teamMember: { name: string; email: string }
  enquiry: {
    subject: string
    message: string
    submitterName: string
    category: string
  }
}

export default function QueryResponsePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [query, setQuery] = useState<QueryData | null>(null)
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadQuery = async () => {
      try {
        const res = await fetch(`/api/queries/${params.id}?token=${token}`)
        if (!res.ok) {
          throw new Error('Query not found or invalid token')
        }
        const data = await res.json()
        setQuery(data)
        if (data.status === 'responded') {
          setSubmitted(true)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load query')
      } finally {
        setIsLoading(false)
      }
    }

    if (token) {
      loadQuery()
    } else {
      setError('Invalid access link')
      setIsLoading(false)
    }
  }, [params.id, token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!response.trim()) return

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/queries/${params.id}?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      })

      if (!res.ok) {
        throw new Error('Failed to submit response')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !query) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            Response Submitted
          </h1>
          <p className="text-slate-600">
            Thank you for your response. The enquiry team has been notified.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-6 h-6 text-brand-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-2">
            Information Request
          </h1>
          <p className="text-slate-600">
            Hi {query?.teamMember.name}, we need your input on an enquiry.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Original enquiry context */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Original Enquiry
          </h2>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium text-slate-700">From:</span>{' '}
              <span className="text-slate-600">{query?.enquiry.submitterName}</span>
            </p>
            <p className="text-sm">
              <span className="font-medium text-slate-700">Subject:</span>{' '}
              <span className="text-slate-600">{query?.enquiry.subject}</span>
            </p>
            <div className="pt-2 border-t border-slate-100 mt-3">
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {query?.enquiry.message}
              </p>
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="bg-brand-50 rounded-xl border border-brand-200 p-6 mb-6">
          <h2 className="text-sm font-medium text-brand-700 uppercase tracking-wide mb-2">
            Question for You
          </h2>
          <p className="text-slate-800 font-medium">{query?.question}</p>
        </div>

        {/* Response form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <label htmlFor="response" className="block text-sm font-medium text-slate-700 mb-2">
            Your Response <span className="text-red-500">*</span>
          </label>
          <textarea
            id="response"
            value={response}
            onChange={e => setResponse(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600 outline-none transition-all min-h-[150px] resize-y"
            placeholder="Please provide your response to the question above..."
            required
          />

          <button
            type="submit"
            disabled={isSubmitting || !response.trim()}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send size={18} />
                Submit Response
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
