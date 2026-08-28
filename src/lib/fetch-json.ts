/**
 * fetch() wrapper that throws on non-2xx responses so React Query mutations
 * and queries actually surface server errors instead of resolving with an
 * error body and firing onSuccess.
 *
 * Throws an Error whose message is the server's `{ error }` field when present.
 */
export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init)

  const text = await res.text()
  let data: any = undefined
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && data.error
        ? data.error
        : typeof data === 'string' && data
          ? data
          : `Request failed (${res.status})`
    throw new Error(message)
  }

  return data as T
}
