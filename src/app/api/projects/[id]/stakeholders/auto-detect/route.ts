import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'
import { findCouncillors } from '@/lib/scrapers'

interface ParliamentMember {
  value: {
    id: number
    nameDisplayAs: string
    latestParty?: {
      name: string
    }
    latestHouseMembership?: {
      membershipFrom: string
    }
  }
}

interface MapItArea {
  name: string
  type: string
  type_name: string
  codes?: {
    gss?: string
  }
}

// Auto-detect political stakeholders based on project location
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // Get project location
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { latitude: true, longitude: true }
  })

  if (!project || !project.latitude || !project.longitude) {
    return NextResponse.json(
      { error: 'Project location not set. Please save a map location first.' },
      { status: 400 }
    )
  }

  const { latitude, longitude } = project
  const detectedStakeholders: Array<{
    name: string
    organization: string | null
    role: string | null
    type: string
    source: string
    notes?: string
    email?: string | null
  }> = []

  let postcode: string | null = null
  let councilName: string | null = null
  let wardName: string | null = null

  // 1. First, get postcode from coordinates using postcodes.io (free, no API key)
  try {
    const postcodeResponse = await fetch(
      `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`
    )

    if (postcodeResponse.ok) {
      const postcodeData = await postcodeResponse.json()
      if (postcodeData.result && postcodeData.result.length > 0) {
        postcode = postcodeData.result[0].postcode
        console.log('Found postcode:', postcode)
      }
    }
  } catch (error) {
    console.error('Error fetching postcode:', error)
  }

  // 2. Look up MP using Parliament API with postcode (if we have one)
  if (postcode) {
    try {
      const mpResponse = await fetch(
        `https://members-api.parliament.uk/api/Members/Search?Location=${encodeURIComponent(postcode)}&IsCurrentMember=true&skip=0&take=1`
      )

      if (mpResponse.ok) {
        const mpData = await mpResponse.json()

        if (mpData.items && mpData.items.length > 0) {
          const member: ParliamentMember = mpData.items[0]
          const mp = member.value
          const constituency = mp.latestHouseMembership?.membershipFrom || 'Unknown Constituency'

          detectedStakeholders.push({
            name: mp.nameDisplayAs,
            organization: mp.latestParty?.name || 'Parliament',
            role: `MP for ${constituency}`,
            type: 'political',
            source: 'UK Parliament API',
            notes: `Member of Parliament. Contact via: https://members.parliament.uk/member/${mp.id}/contact`
          })
        }
      }
    } catch (error) {
      console.error('Error fetching MP data:', error)
    }
  }

  // 3. Look up local council and ward using MapIt API (mysociety)
  try {
    const mapitResponse = await fetch(
      `https://mapit.mysociety.org/point/4326/${longitude},${latitude}?type=WMC,CTY,DIS,MTD,UTA,LBO,COI,LGD,DIW,MTW,UTW,LBW,UTE,UTS,CPC`
    )

    if (mapitResponse.ok) {
      const areas: Record<string, MapItArea> = await mapitResponse.json()

      for (const areaId in areas) {
        const area = areas[areaId]

        // Capture council name for councillor lookup
        if (['DIS', 'MTD', 'UTA', 'LBO', 'CTY'].includes(area.type)) {
          councilName = area.name
        }

        // Capture ward name for councillor lookup
        if (['DIW', 'MTW', 'UTW', 'LBW'].includes(area.type)) {
          wardName = area.name
        }

        // Add parish council if present
        if (area.type === 'CPC') {
          detectedStakeholders.push({
            name: `${area.name} Parish Council`,
            organization: area.name,
            role: 'Parish Council',
            type: 'community_org',
            source: 'MapIt API',
            notes: `Parish councils handle local matters. Search "${area.name} Parish Council" to find contact details and meeting schedules.`
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching MapIt data:', error)
  }

  // 4. Look up councillors from our database
  let councillorDataAvailable = false

  if (councilName && wardName) {
    try {
      const councillors = await findCouncillors(councilName, wardName)

      if (councillors.length > 0) {
        councillorDataAvailable = true

        // Add each councillor individually
        for (const councillor of councillors) {
          detectedStakeholders.push({
            name: `Cllr ${councillor.name}`,
            organization: councilName,
            role: `Councillor for ${councillor.wardName} Ward`,
            type: 'political',
            source: 'Councillor Database',
            notes: councillor.party
              ? `${councillor.party} councillor.${councillor.profileUrl ? ` Profile: ${councillor.profileUrl}` : ''}`
              : councillor.profileUrl
                ? `Profile: ${councillor.profileUrl}`
                : undefined,
            email: councillor.email
          })
        }
      }
      // No fallback placeholder - only add councillors if we have their data
    } catch (error) {
      console.error('Error looking up councillors:', error)
      // No fallback - only add councillors if we have their data
    }
  }

  // 5. Create stakeholders in the database (skip duplicates)
  const created: string[] = []
  const skipped: string[] = []

  for (const stakeholder of detectedStakeholders) {
    // Check if stakeholder already exists (by name and organization)
    const existing = await prisma.stakeholder.findFirst({
      where: {
        projectId: params.id,
        name: stakeholder.name,
        organization: stakeholder.organization
      }
    })

    if (existing) {
      skipped.push(stakeholder.name)
      continue
    }

    // Create the stakeholder
    await prisma.stakeholder.create({
      data: {
        projectId: params.id,
        name: stakeholder.name,
        organization: stakeholder.organization,
        role: stakeholder.role,
        type: stakeholder.type,
        category: stakeholder.type === 'political' ? 'supporter' : 'unknown',
        notes: stakeholder.notes || `Auto-detected from ${stakeholder.source}`,
        email: stakeholder.email,
        influence: stakeholder.type === 'political' ? 4 : 3,
        interest: 3
      }
    })

    created.push(stakeholder.name)
  }

  return NextResponse.json({
    message: `Auto-detected ${detectedStakeholders.length} potential stakeholders`,
    created: created.length,
    skipped: skipped.length,
    details: {
      created,
      skipped,
      searched: {
        latitude,
        longitude,
        postcode,
        council: councilName,
        ward: wardName
      },
      councillorDataAvailable,
      note: !councillorDataAvailable && councilName
        ? `Councillor names not in database for ${councilName}. POST to /api/councils with {"action":"scrape","councilName":"${councilName}"} to populate.`
        : undefined
    }
  })
}
