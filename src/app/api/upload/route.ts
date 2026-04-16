import { NextResponse } from 'next/server'

// Use Edge runtime for smaller uploads (overlays, etc)
export const runtime = 'edge'

// POST - upload image to Vercel Blob storage (or fallback to base64 for small files)
// Note: Large panorama uploads use client-side upload via /api/upload/token
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    // Check if Blob storage is configured - use fetch API for small files
    if (blobToken && file.size <= 4 * 1024 * 1024) {
      const filename = `overlays/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

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
          throw new Error('Blob upload failed')
        }

        const result = await response.json()
        return NextResponse.json({
          url: result.url,
          size: file.size,
          type: file.type,
        })
      } catch (blobError) {
        console.error('Blob upload error:', blobError)
        return NextResponse.json(
          { error: 'Failed to upload to storage' },
          { status: 500 }
        )
      }
    }

    // For files > 4MB, return error - use client-side upload instead
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large for server upload. Use client-side upload for panoramas.' },
        { status: 400 }
      )
    }

    // Fallback: convert to base64 data URL (for files under 3MB)
    if (file.size > 3 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 3MB without Blob storage configured. Contact admin to enable larger uploads.' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )
    const dataUrl = `data:${file.type};base64,${base64}`

    return NextResponse.json({
      url: dataUrl,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
