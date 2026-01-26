import { NextResponse } from 'next/server'

export const runtime = 'edge' // Use edge runtime for larger file uploads

// POST - upload image to Vercel Blob storage
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Check file size - allow up to 50MB
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 400 }
      )
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    // Check if Blob token is configured
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN
    if (!blobToken) {
      return NextResponse.json(
        { error: 'Blob storage not configured. Add BLOB_READ_WRITE_TOKEN to environment.' },
        { status: 500 }
      )
    }

    // Upload to Vercel Blob using REST API
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
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
