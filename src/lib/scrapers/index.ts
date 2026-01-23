import { prisma } from '@/lib/db'
import { scrapeModernGov } from './moderngov'
import { scrapeWestminster } from './westminster'
import { COUNCIL_CONFIGS, type CouncilConfig, type ScrapeResult } from './types'

export { COUNCIL_CONFIGS } from './types'
export type { CouncilConfig, ScrapedCouncillor, ScrapeResult } from './types'

/**
 * Scrape a single council and save councillors to database
 */
export async function scrapeCouncil(config: CouncilConfig): Promise<{
  success: boolean
  created: number
  updated: number
  error?: string
}> {
  // Ensure council exists in database
  let council = await prisma.council.findUnique({
    where: { name: config.name }
  })

  if (!council) {
    council = await prisma.council.create({
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
  }

  // Run the appropriate scraper
  let result: ScrapeResult

  try {
    switch (config.scraperType) {
      case 'westminster':
        result = await scrapeWestminster()
        break
      case 'moderngov':
      default:
        result = await scrapeModernGov(config.councillorsUrl)
        break
    }

    if (!result.success) {
      await prisma.council.update({
        where: { id: council.id },
        data: {
          scrapeStatus: 'failed',
          scrapeError: result.error,
          lastScraped: new Date()
        }
      })

      return {
        success: false,
        created: 0,
        updated: 0,
        error: result.error
      }
    }

    // Save councillors to database
    let created = 0
    let updated = 0

    for (const councillor of result.councillors) {
      // Check if councillor already exists
      const existing = await prisma.councillor.findFirst({
        where: {
          councilId: council.id,
          name: councillor.name
        }
      })

      if (existing) {
        // Update existing councillor
        await prisma.councillor.update({
          where: { id: existing.id },
          data: {
            party: councillor.party || existing.party,
            wardName: councillor.wardName !== 'Unknown Ward' ? councillor.wardName : existing.wardName,
            email: councillor.email || existing.email,
            phone: councillor.phone || existing.phone,
            profileUrl: councillor.profileUrl || existing.profileUrl,
            photoUrl: councillor.photoUrl || existing.photoUrl,
            updatedAt: new Date()
          }
        })
        updated++
      } else {
        // Create new councillor
        await prisma.councillor.create({
          data: {
            councilId: council.id,
            name: councillor.name,
            title: councillor.title || 'Cllr',
            firstName: councillor.firstName,
            lastName: councillor.lastName,
            party: councillor.party,
            wardName: councillor.wardName,
            wardMapitName: councillor.wardName, // Will be matched later
            email: councillor.email,
            phone: councillor.phone,
            profileUrl: councillor.profileUrl,
            photoUrl: councillor.photoUrl,
            source: 'scrape'
          }
        })
        created++
      }
    }

    // Update council status
    await prisma.council.update({
      where: { id: council.id },
      data: {
        scrapeStatus: result.partialData ? 'partial' : 'success',
        scrapeError: null,
        lastScraped: new Date()
      }
    })

    return {
      success: true,
      created,
      updated
    }

  } catch (error) {
    await prisma.council.update({
      where: { id: council.id },
      data: {
        scrapeStatus: 'failed',
        scrapeError: error instanceof Error ? error.message : 'Unknown error',
        lastScraped: new Date()
      }
    })

    return {
      success: false,
      created: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Scrape all configured councils
 */
export async function scrapeAllCouncils(): Promise<{
  total: number
  successful: number
  failed: number
  results: Array<{ council: string; success: boolean; created: number; error?: string }>
}> {
  const results: Array<{ council: string; success: boolean; created: number; error?: string }> = []

  for (const config of COUNCIL_CONFIGS) {
    console.log(`Scraping ${config.name}...`)
    const result = await scrapeCouncil(config)

    results.push({
      council: config.name,
      success: result.success,
      created: result.created,
      error: result.error
    })

    // Small delay between scrapes to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  return {
    total: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  }
}

/**
 * Find councillors for a given council and ward name
 */
export async function findCouncillors(
  councilName: string,
  wardName: string
): Promise<Array<{
  name: string
  party: string | null
  email: string | null
  profileUrl: string | null
  wardName: string
}>> {
  // Try exact match first
  let councillors = await prisma.councillor.findMany({
    where: {
      council: {
        OR: [
          { name: councilName },
          { mapitName: councilName }
        ]
      },
      OR: [
        { wardName: wardName },
        { wardMapitName: wardName },
        // Also try without "Ward" suffix
        { wardName: wardName.replace(/\s*Ward$/i, '') },
        { wardMapitName: wardName.replace(/\s*Ward$/i, '') },
        // Try with "Ward" suffix
        { wardName: `${wardName} Ward` },
        { wardMapitName: `${wardName} Ward` },
      ]
    },
    select: {
      name: true,
      party: true,
      email: true,
      profileUrl: true,
      wardName: true
    }
  })

  // If no exact match, try fuzzy matching
  if (councillors.length === 0) {
    // Get all councillors for this council
    const allCouncillors = await prisma.councillor.findMany({
      where: {
        council: {
          OR: [
            { name: { contains: councilName.split(' ')[0] } },
            { mapitName: { contains: councilName.split(' ')[0] } }
          ]
        }
      },
      select: {
        name: true,
        party: true,
        email: true,
        profileUrl: true,
        wardName: true
      }
    })

    // Simple fuzzy match on ward name
    const wardNameLower = wardName.toLowerCase().replace(/\s*ward$/i, '')
    councillors = allCouncillors.filter(c => {
      const cWard = c.wardName.toLowerCase().replace(/\s*ward$/i, '')
      return cWard.includes(wardNameLower) || wardNameLower.includes(cWard)
    })
  }

  return councillors
}

/**
 * Get statistics about councillor data
 */
export async function getCouncillorStats(): Promise<{
  totalCouncils: number
  totalCouncillors: number
  scrapedCouncils: number
  failedCouncils: number
  lastUpdated: Date | null
}> {
  const [totalCouncils, totalCouncillors, successfulCouncils, failedCouncils, lastUpdated] = await Promise.all([
    prisma.council.count(),
    prisma.councillor.count(),
    prisma.council.count({ where: { scrapeStatus: 'success' } }),
    prisma.council.count({ where: { scrapeStatus: 'failed' } }),
    prisma.council.findFirst({
      where: { lastScraped: { not: null } },
      orderBy: { lastScraped: 'desc' },
      select: { lastScraped: true }
    })
  ])

  return {
    totalCouncils,
    totalCouncillors,
    scrapedCouncils: successfulCouncils,
    failedCouncils,
    lastUpdated: lastUpdated?.lastScraped || null
  }
}
