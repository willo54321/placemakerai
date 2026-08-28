'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
          margin: 0,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: '#0f172a',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
