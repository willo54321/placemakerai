import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { scrapeCouncil, scrapeAllCouncils, getCouncillorStats, COUNCIL_CONFIGS } from '@/lib/scrapers'

// GET /api/councils - List all councils and their scrape status
export async function GET() {
  try {
    const councils = await prisma.council.findMany({
      include: {
        _count: {
          select: { councillors: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    const stats = await getCouncillorStats()

    return NextResponse.json({
      councils: councils.map(c => ({
        id: c.id,
        name: c.name,
        mapitName: c.mapitName,
        type: c.type,
        councillorCount: c._count.councillors,
        scrapeStatus: c.scrapeStatus,
        lastScraped: c.lastScraped,
        scrapeError: c.scrapeError
      })),
      stats,
      availableConfigs: COUNCIL_CONFIGS.map(c => ({
        name: c.name,
        type: c.type,
        scraperType: c.scraperType
      }))
    })
  } catch (error) {
    console.error('Error fetching councils:', error)
    return NextResponse.json(
      { error: 'Failed to fetch councils' },
      { status: 500 }
    )
  }
}

// POST /api/councils - Initialize a council or trigger scrape
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, councilName } = body

    if (action === 'scrape-all') {
      // Scrape all configured councils
      const results = await scrapeAllCouncils()
      return NextResponse.json(results)
    }

    if (action === 'scrape' && councilName) {
      // Scrape a specific council
      const config = COUNCIL_CONFIGS.find(c => c.name === councilName)

      if (!config) {
        return NextResponse.json(
          { error: `Council "${councilName}" not found in configurations` },
          { status: 404 }
        )
      }

      const result = await scrapeCouncil(config)
      return NextResponse.json(result)
    }

    if (action === 'init') {
      // Initialize all council records without scraping
      let created = 0

      for (const config of COUNCIL_CONFIGS) {
        const existing = await prisma.council.findUnique({
          where: { name: config.name }
        })

        if (!existing) {
          await prisma.council.create({
            data: {
              name: config.name,
              mapitName: config.mapitName,
              type: config.type,
              website: config.website,
              councillorsUrl: config.councillorsUrl,
              scraperType: config.scraperType,
              gssCode: config.gssCode,
              scrapeStatus: 'pending'
            }
          })
          created++
        }
      }

      return NextResponse.json({
        message: `Initialized ${created} councils`,
        total: COUNCIL_CONFIGS.length
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "scrape-all", "scrape" with councilName, or "init"' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error in councils API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    )
  }
}
