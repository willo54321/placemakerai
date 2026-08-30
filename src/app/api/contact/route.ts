import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimitResponse } from '@/lib/rate-limit'
import { sendContactNotification } from '@/lib/email'

// Public endpoint for the marketing homepage's Start a Project form. There is
// no email delivery configured, so the row itself is the lead — super admins
// read them at /admin/messages.

const MAX_SHORT = 200
const MAX_MESSAGE = 5000

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, 'contact', 5, 60_000)
  if (limited) return limited

  let body: {
    name?: string
    email?: string
    organization?: string
    projectType?: string
    message?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const name = (body.name || '').trim().slice(0, MAX_SHORT)
  const email = (body.email || '').trim().slice(0, MAX_SHORT)
  const message = (body.message || '').trim().slice(0, MAX_MESSAGE)

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email and message are required' },
      { status: 400 }
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const organization = (body.organization || '').trim().slice(0, MAX_SHORT) || null
  const projectType = (body.projectType || '').trim().slice(0, MAX_SHORT) || null

  await prisma.contactMessage.create({
    data: { name, email, organization, projectType, message },
  })

  // Notify the team by email when configured. The row above is the source of
  // truth — a failed notification must never fail the submission.
  sendContactNotification({ name, email, organization, projectType, message }).catch(() => {})

  return NextResponse.json({ ok: true })
}
