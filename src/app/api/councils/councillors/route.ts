import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { findCouncillors } from '@/lib/scrapers'

// GET /api/councils/councillors?council=Name&ward=WardName
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const council = searchParams.get('council')
    const ward = searchParams.get('ward')

    if (!council || !ward) {
      return NextResponse.json(
        { error: 'Both "council" and "ward" query parameters are required' },
        { status: 400 }
      )
    }

    const councillors = await findCouncillors(council, ward)

    return NextResponse.json({
      council,
      ward,
      councillors,
      count: councillors.length
    })
  } catch (error) {
    console.error('Error looking up councillors:', error)
    return NextResponse.json(
      { error: 'Failed to look up councillors' },
      { status: 500 }
    )
  }
}

// POST /api/councils/councillors - Search councillors with more options
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { council, ward, name, party } = body

    const where: any = {}

    if (council) {
      where.council = {
        OR: [
          { name: { contains: council, mode: 'insensitive' } },
          { mapitName: { contains: council, mode: 'insensitive' } }
        ]
      }
    }

    if (ward) {
      where.OR = [
        { wardName: { contains: ward, mode: 'insensitive' } },
        { wardMapitName: { contains: ward, mode: 'insensitive' } }
      ]
    }

    if (name) {
      where.name = { contains: name, mode: 'insensitive' }
    }

    if (party) {
      where.party = { contains: party, mode: 'insensitive' }
    }

    const councillors = await prisma.councillor.findMany({
      where,
      include: {
        council: {
          select: {
            name: true,
            type: true
          }
        }
      },
      take: 50,
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      councillors: councillors.map(c => ({
        id: c.id,
        name: c.name,
        party: c.party,
        wardName: c.wardName,
        email: c.email,
        profileUrl: c.profileUrl,
        council: c.council.name,
        councilType: c.council.type
      })),
      count: councillors.length
    })
  } catch (error) {
    console.error('Error searching councillors:', error)
    return NextResponse.json(
      { error: 'Failed to search councillors' },
      { status: 500 }
    )
  }
}
