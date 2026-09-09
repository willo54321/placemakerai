import crypto from 'crypto'

/**
 * Verify a Svix-signed webhook (the scheme Resend uses). The signed content is
 * `${id}.${timestamp}.${payload}` HMAC-SHA256'd with the base64 secret that
 * follows the `whsec_` prefix; the signature header carries one or more
 * space-separated `v1,<base64>` candidates. Timestamps outside the tolerance
 * window are rejected to block replays.
 */
export function verifySvixSignature({
  secret,
  id,
  timestamp,
  signature,
  payload,
  toleranceSeconds = 300,
}: {
  secret: string
  id: string | null
  timestamp: string | null
  signature: string | null
  payload: string
  toleranceSeconds?: number
}): boolean {
  if (!id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) return false

  let key: Buffer
  try {
    key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  } catch {
    return false
  }
  if (key.length === 0) return false

  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest()

  return signature.split(' ').some(candidate => {
    const [version, sig] = candidate.split(',')
    if (version !== 'v1' || !sig) return false
    let provided: Buffer
    try {
      provided = Buffer.from(sig, 'base64')
    } catch {
      return false
    }
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
  })
}
