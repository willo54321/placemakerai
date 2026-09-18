import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Photo formats only — no SVG (scriptable), no arbitrary files. HEIC/HEIF
// covers photos straight off an iPhone.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

const MAX_SIZE = 4 * 1024 * 1024 // Vercel serverless body limit is 4.5MB

// Public API - upload photo evidence for a construction-issue report.
// Returns a URL the reporter then submits as `photoUrl` on the pin. The pins
// route only accepts URLs under this project's issues/ prefix, so an upload
// can't be attached to another project's report.
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const limited = await rateLimitResponse(request, 'embed-issue-photo', 5, 60_000)
  if (limited) return limited

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { embedEnabled: true, issuesEnabled: true }
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }
  if (!project.embedEnabled || !project.issuesEnabled) {
    return NextResponse.json({ error: 'Issue reporting not enabled for this project' }, { status: 403 })
  }

  let file: File | null = null
  try {
    const formData = await request.formData()
    const entry = formData.get('file')
    if (entry instanceof File) file = entry
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field' }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return NextResponse.json(
      { error: 'Only JPEG, PNG, WebP, GIF or HEIC photos are allowed' },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Photo too large. Maximum size is 4MB.' }, { status: 400 })
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN

  if (blobToken) {
    // Random filename: uploads must not be guessable (blob URLs are publicly
    // fetchable by anyone who has the exact URL, and reports are private).
    const filename = `issues/${params.id}/${crypto.randomUUID()}.${ext}`
    try {
      const response = await fetch(`https://blob.vercel-storage.com/${filename}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${blobToken}`,
          'Content-Type': file.type,
          'x-api-version': '7',
        },
        body: file,
      })
      if (!response.ok) {
        throw new Error(`Blob upload failed: ${response.status}`)
      }
      const result = await response.json()
      return NextResponse.json({ url: result.url, size: file.size, type: file.type })
    } catch (blobError) {
      console.error('Issue photo upload error:', blobError)
      return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 })
    }
  }

  // No Blob storage configured (local dev): fall back to a base64 data URL,
  // same as the admin upload route. Keep it small — it ends up in the DB row.
  if (file.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: 'Photo too large. Maximum size is 3MB.' }, { status: 400 })
  }
  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return NextResponse.json({
    url: `data:${file.type};base64,${base64}`,
    size: file.size,
    type: file.type,
  })
}
