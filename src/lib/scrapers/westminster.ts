import { parse } from 'node-html-parser'
import type { ScrapedCouncillor, ScrapeResult } from './types'

/**
 * Scraper for Westminster City Council
 * Uses ModernGov system at committees.westminster.gov.uk
 */
export async function scrapeWestminster(): Promise<ScrapeResult> {
  // Westminster uses ModernGov system
  const modGovUrl = 'https://committees.westminster.gov.uk/mgMemberIndex.aspx'
  return await scrapeWestminsterModernGov(modGovUrl)
}

async function scrapeWestminsterModernGov(url: string): Promise<ScrapeResult> {
  const councillors: ScrapedCouncillor[] = []

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ConsultationPlatform/1.0; +https://consultation-platform.com)',
        'Accept': 'text/html,application/xhtml+xml',
      }
    })

    if (!response.ok) {
      return {
        success: false,
        councillors: [],
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }

    const html = await response.text()
    const root = parse(html)

    // Westminster uses mgThumbsList with <li> elements
    // Structure: <li><a href="mgUserInfo..."><img/>Councillor Name</a><p>Ward</p><p>Party</p></li>
    const memberItems = root.querySelectorAll('.mgThumbsList li')

    for (const item of memberItems) {
      const nameLink = item.querySelector('a')
      if (!nameLink) continue

      const href = nameLink.getAttribute('href') || ''
      if (!href.includes('mgUserInfo')) continue

      // Name is in the link text (after image), clean it
      const name = nameLink.text.trim().replace(/^(Cllr\.?|Councillor)\s*/i, '')
      if (!name || name.length < 3) continue

      const profileUrl = new URL(href, url).href

      // Ward and party are in <p> tags after the link
      const paragraphs = item.querySelectorAll('p')
      let wardName = 'Unknown Ward'
      let party: string | undefined

      // First <p> is typically the ward, second <p> is typically the party
      if (paragraphs.length >= 1) {
        wardName = paragraphs[0].text.trim()
      }
      if (paragraphs.length >= 2) {
        const partyText = paragraphs[1].text.trim()
        if (['Labour', 'Conservative', 'Liberal Democrat', 'Green', 'Independent'].some(p =>
          partyText.toLowerCase().includes(p.toLowerCase())
        )) {
          party = partyText
        }
      }

      // Get photo URL if available
      const img = item.querySelector('img')
      const photoUrl = img ? new URL(img.getAttribute('src') || '', url).href : undefined

      councillors.push({
        name,
        wardName,
        party,
        profileUrl,
        photoUrl
      })
    }

    // Fallback: try table-based extraction if mgThumbsList didn't work
    if (councillors.length === 0) {
      const tableRows = root.querySelectorAll('table tr')

      for (const row of tableRows) {
        if (row.querySelector('th')) continue

        const nameLink = row.querySelector('a')
        if (!nameLink) continue

        const href = nameLink.getAttribute('href') || ''
        if (!href.includes('mgUserInfo')) continue

        const name = nameLink.text.trim().replace(/^(Cllr\.?|Councillor)\s*/i, '')
        if (!name || name.length < 3) continue

        const cells = row.querySelectorAll('td')
        let wardName = 'Unknown Ward'

        for (const cell of cells) {
          const text = cell.text.trim()
          if (text !== name && text.length > 2 && text.length < 40) {
            wardName = text.replace(/\s*ward$/i, '').trim()
            break
          }
        }

        const partyMatch = row.text.match(/(Labour|Conservative|Liberal Democrat|Green|Independent)/i)
        const party = partyMatch ? partyMatch[1] : undefined

        councillors.push({
          name,
          wardName,
          party,
          profileUrl: new URL(href, url).href
        })
      }
    }

    return {
      success: councillors.length > 0,
      councillors: deduplicateByName(councillors),
      partialData: councillors.some(c => c.wardName === 'Unknown Ward')
    }

  } catch (error) {
    return {
      success: false,
      councillors: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function deduplicateByName(councillors: ScrapedCouncillor[]): ScrapedCouncillor[] {
  const seen = new Map<string, ScrapedCouncillor>()

  for (const c of councillors) {
    const key = c.name.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, c)
    }
  }

  return Array.from(seen.values())
}
