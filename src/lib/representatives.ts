import { MODERNGOV_COUNCILS } from '@/data/moderngov-councils'

/**
 * Look up a location's elected representatives from authoritative public
 * sources: postcodes.io resolves coordinates to constituency/ward/council,
 * the UK Parliament Members API gives the sitting MP with contact details,
 * and the council's own ModernGov democracy site lists every councillor with
 * their ward, party and email. Everything degrades gracefully — a source
 * being down or a council not running ModernGov yields partial results, not
 * an error.
 */

export interface Representative {
  name: string
  email: string | null
  phone: string | null
  role: string
  organization: string
  party: string | null
  ward: string | null
}

export interface RepresentativesResult {
  constituency: string | null
  district: string | null
  ward: string | null
  mp: Representative | null
  councillors: Representative[]
  councilSource: string | null
}

const FETCH_TIMEOUT_MS = 10000

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()
}

function xmlField(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
  const value = match ? decodeXmlEntities(match[1]) : ''
  return value || null
}

interface GeoResult {
  constituency: string | null
  district: string | null
  ward: string | null
}

async function reverseGeocode(latitude: number, longitude: number): Promise<GeoResult | null> {
  // radius=2000 (the API maximum) — project sites are often further than the
  // default 100m from the nearest postcode centroid.
  const data = (await getJson(
    `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&radius=2000&limit=1`
  )) as { result?: Array<Record<string, string | null>> } | null
  const nearest = data?.result?.[0]
  if (!nearest) return null
  return {
    constituency: nearest.parliamentary_constituency ?? null,
    district: nearest.admin_district ?? null,
    ward: nearest.admin_ward ?? null,
  }
}

async function findMp(constituency: string): Promise<Representative | null> {
  const search = (await getJson(
    `https://members-api.parliament.uk/api/Location/Constituency/Search?searchText=${encodeURIComponent(constituency)}&skip=0&take=5`
  )) as {
    items?: Array<{
      value?: {
        name?: string
        currentRepresentation?: {
          member?: { value?: { id?: number; nameDisplayAs?: string; latestParty?: { name?: string } } }
        }
      }
    }>
  } | null

  const match = search?.items?.find(
    item => item.value?.name?.toLowerCase() === constituency.toLowerCase()
  ) ?? search?.items?.[0]
  const member = match?.value?.currentRepresentation?.member?.value
  if (!member?.id || !member.nameDisplayAs) return null

  const contact = (await getJson(
    `https://members-api.parliament.uk/api/Members/${member.id}/Contact`
  )) as { value?: Array<{ type?: string; email?: string | null; phone?: string | null }> } | null
  const office = contact?.value?.find(c => c.type === 'Parliamentary office')

  return {
    name: member.nameDisplayAs,
    email: office?.email ?? null,
    phone: office?.phone ?? null,
    role: `MP — ${match?.value?.name ?? constituency}`,
    organization: 'UK Parliament',
    party: member.latestParty?.name ?? null,
    ward: null,
  }
}

/** Ward names differ slightly between sources ("Lloyds & Corby Village" vs
 * "Lloyds and Corby Village") — compare on a normalised form. */
function normalizeWard(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
}

async function findCouncillors(
  district: string,
  ward: string | null
): Promise<{ councillors: Representative[]; source: string | null }> {
  const baseUrl = MODERNGOV_COUNCILS[district]
  if (!baseUrl || !ward) return { councillors: [], source: null }
  const source = `${baseUrl}/mgWebService.asmx/GetCouncillorsByWard`

  let xml: string
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) return { councillors: [], source: null }
    xml = await res.text()
  } catch {
    return { councillors: [], source: null }
  }
  if (!xml.includes('<councillorsbyward>')) return { councillors: [], source: null }

  // Only the site's own ward members — councillors are the local voice for
  // the ward the project sits in, not the whole chamber.
  const organization = `${district} Council`
  const councillors: Representative[] = []
  for (const wardBlock of xml.split('<ward>').slice(1)) {
    const wardTitle = xmlField(wardBlock, 'wardtitle')
    if (!wardTitle || normalizeWard(wardTitle) !== normalizeWard(ward)) continue
    for (const block of wardBlock.match(/<councillor>[\s\S]*?<\/councillor>/g) ?? []) {
      const rawName = xmlField(block, 'fullusername')
      if (!rawName) continue
      councillors.push({
        name: rawName.replace(/^(County |City |Town )?(Councillor|Cllr\.?)\s+/i, ''),
        email: xmlField(block, 'email'),
        phone: xmlField(block, 'phone') ?? xmlField(block, 'mobile'),
        role: wardTitle ? `Councillor — ${wardTitle}` : 'Councillor',
        organization,
        party: xmlField(block, 'politicalpartytitle'),
        ward: wardTitle,
      })
    }
  }
  return { councillors, source: councillors.length ? source : null }
}

export async function lookupRepresentatives(
  latitude: number,
  longitude: number
): Promise<RepresentativesResult | null> {
  const geo = await reverseGeocode(latitude, longitude)
  if (!geo) return null

  const [mp, council] = await Promise.all([
    geo.constituency ? findMp(geo.constituency) : Promise.resolve(null),
    geo.district
      ? findCouncillors(geo.district, geo.ward)
      : Promise.resolve({ councillors: [], source: null }),
  ])

  return {
    constituency: geo.constituency,
    district: geo.district,
    ward: geo.ward,
    mp,
    councillors: council.councillors,
    councilSource: council.source,
  }
}
