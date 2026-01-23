import { parse, HTMLElement } from 'node-html-parser'
import type { ScrapedCouncillor, ScrapeResult } from './types'

/**
 * Scraper for ModernGov council management systems
 * Used by ~150+ UK councils
 * URL pattern: /mgMemberIndex.aspx
 */
export async function scrapeModernGov(councillorsUrl: string): Promise<ScrapeResult> {
  const councillors: ScrapedCouncillor[] = []

  try {
    // Fetch the councillors page
    const response = await fetch(councillorsUrl, {
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

    // ModernGov typically has councillors in a table
    // Try table rows first (most common)
    const tableRows = root.querySelectorAll('table tr')

    for (const row of tableRows) {
      // Skip header rows
      if (row.querySelector('th')) continue

      const councillor = parseModernGovTableRow(row, councillorsUrl)
      if (councillor) {
        councillors.push(councillor)
      }
    }

    // Try mgMember divs (alternative layout)
    if (councillors.length === 0) {
      const memberDivs = root.querySelectorAll('.mgMember, .councillor-card, .member-card')
      for (const elem of memberDivs) {
        const councillor = parseModernGovCard(elem, councillorsUrl)
        if (councillor) {
          councillors.push(councillor)
        }
      }
    }

    // Try generic link-based extraction (fallback)
    if (councillors.length === 0) {
      const links = root.querySelectorAll('a')
      for (const link of links) {
        const href = link.getAttribute('href') || ''
        if (!href.includes('mgUserInfo') && !href.includes('Councillor')) continue

        const name = link.text.trim()
        if (!name || name.length < 3 || name.toLowerCase() === 'councillor') continue

        // Try to find ward info nearby
        const parent = link.parentNode
        const text = parent?.text || ''
        const wardMatch = text.match(/[-–]\s*([A-Z][a-zA-Z\s&']+(?:Ward)?)/i)
        const ward = wardMatch ? wardMatch[1].trim().replace(/\s*Ward$/i, '') : 'Unknown Ward'

        councillors.push({
          name: cleanName(name),
          wardName: ward,
          profileUrl: resolveUrl(href, councillorsUrl)
        })
      }
    }

    // Deduplicate by name
    const uniqueCouncillors = deduplicateCouncillors(councillors)

    return {
      success: uniqueCouncillors.length > 0,
      councillors: uniqueCouncillors,
      partialData: uniqueCouncillors.length > 0 && uniqueCouncillors.some(c => c.wardName === 'Unknown Ward')
    }

  } catch (error) {
    return {
      success: false,
      councillors: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function parseModernGovTableRow(row: HTMLElement, baseUrl: string): ScrapedCouncillor | null {
  const cells = row.querySelectorAll('td')
  if (cells.length < 2) return null

  // Try to find name link
  const nameLink = row.querySelector('a')
  const nameText = nameLink ? nameLink.text.trim() : cells[0]?.text.trim()

  if (!nameText || nameText.length < 3) return null

  // Extract ward - usually in a specific column
  let wardName = 'Unknown Ward'
  for (const cell of cells) {
    const text = cell.text.trim()
    if (text.match(/ward$/i) || (text.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/) && text.length < 40)) {
      if (!text.toLowerCase().includes('councillor') && text.length > 2) {
        wardName = text.replace(/\s*ward$/i, '').trim()
        break
      }
    }
  }

  // Extract party from row text
  const party = extractParty(row.text)

  // Extract email
  const emailLink = row.querySelector('a[href^="mailto:"]')
  const email = emailLink ? emailLink.getAttribute('href')?.replace('mailto:', '') : undefined

  // Profile URL
  const href = nameLink?.getAttribute('href')
  const profileUrl = href ? resolveUrl(href, baseUrl) : undefined

  return {
    name: cleanName(nameText),
    wardName,
    party,
    email,
    profileUrl
  }
}

function parseModernGovCard(card: HTMLElement, baseUrl: string): ScrapedCouncillor | null {
  const nameElem = card.querySelector('.mgMemberName, .councillor-name, h3, h4, a')
  const name = nameElem?.text.trim()

  if (!name || name.length < 3) return null

  // Find ward
  let wardName = 'Unknown Ward'
  const wardElem = card.querySelector('.mgWard, .ward-name, .councillor-ward')
  if (wardElem) {
    wardName = wardElem.text.trim().replace(/\s*ward$/i, '')
  }

  // Find party
  const partyElem = card.querySelector('.mgParty, .party-name, .councillor-party')
  const party = partyElem ? extractParty(partyElem.text) : undefined

  // Find email
  const emailLink = card.querySelector('a[href^="mailto:"]')
  const email = emailLink ? emailLink.getAttribute('href')?.replace('mailto:', '') : undefined

  // Profile URL
  const profileLink = card.querySelector('a')
  const href = profileLink?.getAttribute('href')
  const profileUrl = href ? resolveUrl(href, baseUrl) : undefined

  return {
    name: cleanName(name),
    wardName,
    party,
    email,
    profileUrl
  }
}

function cleanName(name: string): string {
  return name
    .replace(/^(Cllr\.?|Councillor)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractParty(text: string): string | undefined {
  const partyPatterns: Record<string, string> = {
    'labour': 'Labour',
    'conservative': 'Conservative',
    'lib dem': 'Liberal Democrat',
    'liberal democrat': 'Liberal Democrat',
    'green': 'Green',
    'independent': 'Independent',
    'snp': 'SNP',
    'plaid': 'Plaid Cymru',
  }

  const lower = text.toLowerCase()
  for (const [pattern, party] of Object.entries(partyPatterns)) {
    if (lower.includes(pattern)) {
      return party
    }
  }

  return undefined
}

function resolveUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined
  try {
    return new URL(url, baseUrl).href
  } catch {
    return url
  }
}

function deduplicateCouncillors(councillors: ScrapedCouncillor[]): ScrapedCouncillor[] {
  const seen = new Map<string, ScrapedCouncillor>()

  for (const c of councillors) {
    const key = c.name.toLowerCase()
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, c)
    } else {
      seen.set(key, {
        ...existing,
        wardName: existing.wardName !== 'Unknown Ward' ? existing.wardName : c.wardName,
        party: existing.party || c.party,
        email: existing.email || c.email,
        profileUrl: existing.profileUrl || c.profileUrl,
        photoUrl: existing.photoUrl || c.photoUrl,
      })
    }
  }

  return Array.from(seen.values())
}
