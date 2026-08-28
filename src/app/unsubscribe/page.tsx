'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { MapPin, Loader2, CheckCircle } from 'lucide-react'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const sid = searchParams.get('sid') || ''

  const [isLoading, setIsLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleUnsubscribe = async () => {
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sid }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Something went wrong. Please try again.')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Placemaker.ai</h1>
        </div>

        {!sid ? (
          <>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Invalid link</h2>
            <p className="text-slate-600">
              This unsubscribe link is incomplete. Please use the link from the bottom of the email you received.
            </p>
          </>
        ) : done ? (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">You&apos;re unsubscribed</h2>
            <p className="text-slate-600">
              You won&apos;t receive any more project updates at this address.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Unsubscribe</h2>
            <p className="text-slate-600 mb-6">
              Stop receiving project update emails from this mailing list?
            </p>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
            )}

            <button
              onClick={handleUnsubscribe}
              disabled={isLoading}
              className="w-full bg-brand-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Unsubscribing...
                </>
              ) : (
                'Unsubscribe'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  )
}
