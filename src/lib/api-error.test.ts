import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { handleApiError, withApiHandler } from './api-error'

const req = (method = 'POST') =>
  new Request('http://localhost/api/projects/p1/tours', { method })

describe('handleApiError', () => {
  it('decodes an unreachable database (dev Postgres not running) to 503', async () => {
    const err = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at `localhost:54322`",
      '5.9.0'
    )
    const res = handleApiError(err, req())
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('DB_UNAVAILABLE')
    expect(body.error).toMatch(/database is currently unavailable/i)
    // Non-production: the raw cause is surfaced for local debugging.
    expect(body.detail).toMatch(/localhost:54322/)
  })

  it('decodes a missing column (schema drift) to an actionable 500', async () => {
    const err = new Prisma.PrismaClientKnownRequestError(
      'The column `TourStop.icon` does not exist in the current database.',
      { code: 'P2022', clientVersion: '5.9.0' }
    )
    const res = handleApiError(err, req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('P2022')
    expect(body.error).toMatch(/schema is out of date/i)
  })

  it('maps a unique-constraint violation to 409', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.9.0',
    })
    expect(handleApiError(err).status).toBe(409)
  })

  it('maps a malformed JSON body to 400', async () => {
    const res = handleApiError(new SyntaxError('Unexpected end of JSON input'))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('BAD_JSON')
  })

  it('falls back to a generic 500 for unknown errors', async () => {
    const res = handleApiError(new Error('boom'))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/unexpected server error/i)
  })
})

describe('withApiHandler', () => {
  it('passes a successful response through untouched', async () => {
    const handler = withApiHandler(async () => new Response('ok', { status: 201 }))
    const res = await handler(req(), {})
    expect(res.status).toBe(201)
    expect(await res.text()).toBe('ok')
  })

  it('catches a thrown error and returns the decoded response', async () => {
    const handler = withApiHandler(async () => {
      throw new Prisma.PrismaClientInitializationError('down', '5.9.0')
    })
    const res = await handler(req(), {})
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('DB_UNAVAILABLE')
  })
})
