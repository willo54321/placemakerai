import { NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'

// Generate a client upload token for direct Blob uploads
export async function GET(request: Request) {
  try {
    // Require authentication
    const session = await getAuth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      return NextResponse.json(
        { error: 'Blob storage not configured' },
        { status: 500 }
      )
    }

    // Return the token for client-side upload
    // In production, you'd want to generate a limited-scope token
    return NextResponse.json({ token })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate upload token' },
      { status: 500 }
    )
  }
}
