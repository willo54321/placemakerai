import { NextResponse } from 'next/server'

export const runtime = 'edge'

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

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN

    // If Blob is configured, use it for any size up to 50MB
    if (blobToken) {
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 50MB.' },
          { status: 400 }
        )
      }

      const filename = `overlays/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

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
        const errorText = await response.text()
        console.error('Blob upload error:', response.status, errorText)
        return NextResponse.json(
          { error: 'Failed to upload to storage' },
          { status: 500 }
        )
      }

      const result = await response.json()
      return NextResponse.json({
        url: result.url,
        size: file.size,
        type: file.type,
      })
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
