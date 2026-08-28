import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { Prisma } from '@prisma/client'

// GDPR data-subject request tooling (super admin only).
// GET  ?email=  -> find everything held for that email address (the response
//                  doubles as the subject-access-request export)
// DELETE {email} -> erase all of it

async function requireSuperAdmin(): Promise<NextResponse | null> {
  const session = await getAuth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true },
  })
  if (currentUser?.systemRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

async function findSubjectData(email: string) {
  const [pins, enquiries, accounts] = await Promise.all([
    // Legacy rows only — pin submissions no longer collect email.
    prisma.publicPin.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        comment: true,
        name: true,
        email: true,
        category: true,
        latitude: true,
        longitude: true,
        approved: true,
        gdprConsent: true,
        gdprConsentDate: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.enquiry.findMany({
      where: { submitterEmail: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        submitterName: true,
        submitterEmail: true,
        submitterPhone: true,
        submitterOrg: true,
        subject: true,
        message: true,
        gdprConsent: true,
        gdprConsentDate: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    // Dashboard user accounts are personal data too (name, email, hashed
    // password) — the privacy policy lists them, so the tool must cover them.
    prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        id: true,
        name: true,
        email: true,
        systemRole: true,
        createdAt: true,
        projectAccess: { select: { role: true, project: { select: { name: true } } } },
      },
    }),
  ])

  // Form response data is free-form JSON, so match on the serialized text.
  // This over-matches (any field containing the address) — correct behavior
  // for a rights request, where missing a record is worse than reviewing one.
  const responseIds = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM "FeedbackResponse" WHERE data::text ILIKE ${'%' + email + '%'}`
  )
  const formResponses = responseIds.length
    ? await prisma.feedbackResponse.findMany({
        where: { id: { in: responseIds.map(r => r.id) } },
        select: {
          id: true,
          data: true,
          gdprConsent: true,
          gdprConsentDate: true,
          submittedAt: true,
          form: {
            select: { id: true, name: true, Project: { select: { id: true, name: true } } },
          },
        },
      })
    : []

  return { pins, enquiries, formResponses, accounts }
}

export async function GET(request: Request) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  const email = new URL(request.url).searchParams.get('email')?.trim()
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  try {
    const data = await findSubjectData(email)
    return NextResponse.json({
      email,
      searchedAt: new Date().toISOString(),
      counts: {
        pins: data.pins.length,
        enquiries: data.enquiries.length,
        formResponses: data.formResponses.length,
        accounts: data.accounts.length,
      },
      ...data,
    })
  } catch (error) {
    console.error('GDPR search failed:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const denied = await requireSuperAdmin()
  if (denied) return denied

  let email: string | undefined
  try {
    email = (await request.json())?.email?.trim()
  } catch {
    // fall through to validation
  }
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  try {
    const data = await findSubjectData(email)
    // Never erase super-admin accounts through this tool — that's platform
    // administration (and self-lockout), not a subject request. Handle those
    // deliberately via /admin/users.
    const deletableAccounts = data.accounts.filter(a => a.systemRole !== 'SUPER_ADMIN')
    const skippedAccounts = data.accounts.length - deletableAccounts.length
    const [pins, enquiries, formResponses, accounts] = await prisma.$transaction([
      prisma.publicPin.deleteMany({ where: { id: { in: data.pins.map(p => p.id) } } }),
      prisma.enquiry.deleteMany({ where: { id: { in: data.enquiries.map(e => e.id) } } }),
      prisma.feedbackResponse.deleteMany({
        where: { id: { in: data.formResponses.map(r => r.id) } },
      }),
      prisma.user.deleteMany({ where: { id: { in: deletableAccounts.map(a => a.id) } } }),
    ])
    console.log(
      `GDPR erasure for ${email}: ${pins.count} pins, ${enquiries.count} enquiries, ${formResponses.count} form responses, ${accounts.count} accounts${skippedAccounts ? ` (${skippedAccounts} super-admin account skipped)` : ''}`
    )
    return NextResponse.json({
      email,
      deleted: {
        pins: pins.count,
        enquiries: enquiries.count,
        formResponses: formResponses.count,
        accounts: accounts.count,
      },
      skippedSuperAdminAccounts: skippedAccounts,
    })
  } catch (error) {
    console.error('GDPR erasure failed:', error)
    return NextResponse.json({ error: 'Erasure failed' }, { status: 500 })
  }
}
