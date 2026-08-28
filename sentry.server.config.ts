import * as Sentry from '@sentry/nextjs'

// Inert until SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set in the environment.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  tracesSampleRate: 0.1,
})
