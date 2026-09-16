import { NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiter for public write endpoints.
 *
 * When UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are set (the Vercel
 * Upstash integration provides both), limits are enforced globally via a
 * shared Redis sliding window — the same bucket regardless of which
 * serverless instance handles the request.
 *
 * Without those env vars (local dev, or before the integration is added) it
 * falls back to the original per-instance in-memory limiter: still a useful
 * first line of defence against scripted abuse, but not a global guarantee.
 * Redis errors also fall back to memory rather than failing open.
 */
type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null

// One Ratelimit per (scope, limit, window) combination, created lazily.
const limiters = new Map<string, Ratelimit>()
function getLimiter(scope: string, limit: number, windowMs: number): Ratelimit {
  const key = `${scope}:${limit}:${windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `rl:${scope}`,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

export function getClientIp(request: Request): string {
  const h = request.headers
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') || 'unknown'
}

/**
 * Register a hit for `key` against the in-memory fallback limiter.
 * Returns { ok:false } when the limit is exceeded.
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
}

function tooManyRequests(retryAfter: number) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  )
}

/**
 * Convenience guard for route handlers. Returns a 429 NextResponse to return
 * immediately when rate limited, or `null` to proceed.
 */
export async function rateLimitResponse(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number
): Promise<NextResponse | null> {
  const ip = getClientIp(request)

  if (redis) {
    try {
      const result = await getLimiter(scope, limit, windowMs).limit(ip)
      if (result.success) return null
      const retryAfter = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000)
      )
      return tooManyRequests(retryAfter)
    } catch (error) {
      console.error(`Rate limit Redis error (scope ${scope}):`, error)
      // Fall through to the in-memory limiter.
    }
  }

  const { ok, retryAfter } = rateLimit(`${scope}:${ip}`, limit, windowMs)
  return ok ? null : tooManyRequests(retryAfter)
}
