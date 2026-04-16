import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

// Use Node.js runtime for larger file uploads (Edge has 4MB limit)
export const runtime = 'nodejs'

// Allow larger request bodies for panorama images
export const maxDuration = 60

// POST - upload image to Vercel Blob storage (or fallback to base64 for small files)
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

    // Check if Blob storage is configured
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 50MB.' },
          { status: 400 }
        )
      }

      const filename = `panoramas/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

      try {
        const blob = await put(filename, file, {
          access: 'public',
          contentType: file.type,
        })

        return NextResponse.json({
          url: blob.url,
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
