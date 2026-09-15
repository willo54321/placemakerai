/**
 * Centralised API error handling.
 *
 * Route handlers that touch the database (or anything that can throw) leak an
 * opaque, bodiless Next.js 500 when an exception escapes — the client only sees
 * "Request failed (500)" and the real cause is lost. Wrap a handler in
 * `withApiHandler` (or call `handleApiError` inside your own catch) to:
 *
 *   1. Log the full error server-side with the method + path, so it shows up in
 *      the `npm run dev` terminal and in Vercel function logs.
 *   2. Decode common Prisma failures (DB unreachable, schema drift, constraint
 *      violations) into an accurate HTTP status + a message the caller can act on.
 *   3. Return a JSON `{ error, code }` body — which `fetchJson` surfaces in the
 *      UI toast — plus a raw `detail` when NOT in production for fast local
 *      debugging (never leaks connection strings / SQL to production clients).
 */
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

const isDev = process.env.NODE_ENV !== 'production'

interface Decoded {
  status: number
  /** Client-safe, actionable message. Never contains secrets or SQL. */
  message: string
  /** Stable machine-readable code, safe to expose (e.g. 'P2022'). */
  code?: string
}

function decode(error: unknown): Decoded {
  // Database unreachable / connection failed (e.g. dev Postgres not running).
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      message: 'The database is currently unavailable. Please try again shortly.',
      code: 'DB_UNAVAILABLE',
    }
  }

  // Known request errors carry a P-code.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2021': // table does not exist
      case 'P2022': // column does not exist
        return {
          status: 500,
          message: `The database schema is out of date (${error.code}) — a schema update (db push) is required.`,
          code: error.code,
        }
      case 'P2002': // unique constraint
        return { status: 409, message: 'A record with those details already exists.', code: 'P2002' }
      case 'P2003': // foreign key constraint
        return { status: 409, message: 'This action conflicts with related data.', code: 'P2003' }
      case 'P2025': // record required but not found
        return { status: 404, message: 'The requested record was not found.', code: 'P2025' }
      default:
        return { status: 500, message: `A database error occurred (${error.code}).`, code: error.code }
    }
  }

  // Bad shape passed to Prisma (wrong types, unknown fields, etc.).
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, message: 'The request data was invalid.', code: 'PRISMA_VALIDATION' }
  }

  // Malformed request body — `await request.json()` throws SyntaxError.
  if (error instanceof SyntaxError) {
    return { status: 400, message: 'Invalid JSON body.', code: 'BAD_JSON' }
  }

  return { status: 500, message: 'An unexpected server error occurred.' }
}

function pathOf(request?: Request): string {
  if (!request) return 'api'
  try {
    return `${request.method} ${new URL(request.url).pathname}`
  } catch {
    return `${request.method} ${request.url}`
  }
}

/**
 * Log an error and turn it into a JSON error response. Call this inside a catch
 * block, or let `withApiHandler` call it for you.
 */
export function handleApiError(error: unknown, request?: Request): NextResponse {
  const { status, message, code } = decode(error)

  // Full detail server-side only — greppable prefix, real stack/cause included.
  console.error(`[api-error] ${pathOf(request)}${code ? ` [${code}]` : ''}:`, error)

  const body: Record<string, unknown> = { error: message }
  if (code) body.code = code
  if (isDev) body.detail = error instanceof Error ? error.message : String(error)

  return NextResponse.json(body, { status })
}

type ApiHandler<Ctx> = (request: Request, context: Ctx) => Promise<Response> | Response

/**
 * Wrap a route handler so any thrown error is logged and returned as a decoded
 * JSON error instead of an opaque 500.
 *
 *   export const POST = withApiHandler(async (request, { params }: { params: { id: string } }) => {
 *     // ...may throw; the wrapper handles it
 *   })
 */
export function withApiHandler<Ctx>(handler: ApiHandler<Ctx>): ApiHandler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      return handleApiError(error, request)
    }
  }
}
