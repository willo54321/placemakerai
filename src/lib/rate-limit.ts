import { NextResponse } from 'next/server'

/**
 * Best-effort in-memory rate limiter for public write endpoints.
 *
 * NOTE: This is per-instance memory. On serverless (Vercel) each lambda
 * instance keeps its own buckets, so this throttles bursts against a single
 * instance rather than providing a global guarantee. For strong limits back
 * this with a shared store (e.g. Upstash Redis / @upstash/ratelimit). It is
 * still valuable as a cheap first line of defence against scripted abuse.
 */
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export function getClientIp(request: Request): string {
  const h = request.headers
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') || 'unknown'
}

/**
 * Register a hit for `key`. Returns { ok:false } when the limit is exceeded.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  return { ok: true, retryAfter: 0 }

  // Opportunistic cleanup is handled lazily on the next hit for a key.
}

/**
 * Convenience guard for route handlers. Returns a 429 NextResponse to return
 * immediately when rate limited, or `null` to proceed.
 */
export function rateLimitResponse(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
) {
  const key = `${scope}:${getClientIp(request)}`
  const { ok, retryAfter } = rateLimit(key, limit, windowMs)
  if (ok) return null
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}
