import * as Sentry from '@sentry/nextjs'

// Inert until NEXT_PUBLIC_SENTRY_DSN is set (in Vercel env + a rebuild).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
})
