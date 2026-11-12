import { NextResponse } from 'next/server'
import { authorizeProject } from '@/lib/api-auth'
import { logAudit } from '@/lib/audit'
import { readFormSheet, toBuilderFields, type FormImageMediaType } from '@/lib/form-reader'

// Read an uploaded paper feedback form (photo/scan image or PDF) and return a
// draft online form for the admin to review in the builder. Nothing is saved
// here — the admin creates the form through the normal POST once happy.
export const maxDuration = 60

const ALLOWED: FormImageMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
// Base64 inflates by ~4/3; keep the decoded payload comfortably under Claude's limits.
const MAX_BASE64 = 28 * 1024 * 1024

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const denied = await authorizeProject(params.id, 'ADMIN')
  if (denied) return denied

  let body: { base64?: unknown; mediaType?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const mediaType = body.mediaType
  const base64 = body.base64
  if (typeof base64 !== 'string' || !base64) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (typeof mediaType !== 'string' || !ALLOWED.includes(mediaType as FormImageMediaType)) {
    return NextResponse.json({ error: 'Upload a photo, scan or PDF of the form' }, { status: 400 })
  }
  if (base64.length > MAX_BASE64) {
    return NextResponse.json({ error: 'That file is too large — try a smaller image or PDF' }, { status: 413 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI reading is not configured' }, { status: 503 })
  }

  try {
    const reading = await readFormSheet({ base64, mediaType: mediaType as FormImageMediaType })
    const fields = toBuilderFields(reading)
    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'No questions were found on that form — try a clearer image' },
        { status: 422 }
      )
    }

    await logAudit({
      projectId: params.id,
      action: 'form.read',
      targetType: 'FeedbackForm',
      detail: { fieldCount: fields.length },
    })

    return NextResponse.json({ name: reading.name, fields })
  } catch (error) {
    console.error('Form read error:', error)
    return NextResponse.json({ error: 'Could not read that form — please try again' }, { status: 502 })
  }
}
