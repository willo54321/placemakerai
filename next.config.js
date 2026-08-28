const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Required on Next 14 for instrumentation.ts (Sentry server init)
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        // Baseline hardening for every response.
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // The admin app must not be frameable (clickjacking). The public
        // embed and form surfaces are excluded — being iframed on customer
        // sites is their whole purpose.
        source: '/((?!embed|forms|api).*)',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

// Sentry wrapping injects the client config; without a SENTRY_AUTH_TOKEN it
// skips source-map upload, and without a DSN the SDK is a no-op at runtime.
module.exports = withSentryConfig(nextConfig, { silent: true })
