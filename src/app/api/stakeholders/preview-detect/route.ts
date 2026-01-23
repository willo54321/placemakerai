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

interface DetectedStakeholder {
  name: string
  organization: string | null
  role: string | null
  type: string
  source: string
  notes?: string
  email?: string | null
}

// Preview stakeholder detection based on coordinates (no project required)
export async function POST(request: Request) {
  try {
    const { latitude, longitude } = await request.json()

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    const stakeholders: DetectedStakeholder[] = []
    let postcode: string | null = null
    let councilName: string | null = null
    let wardName: string | null = null

    // 1. Get postcode from coordinates
    try {
      const postcodeResponse = await fetch(
        `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`
      )

      if (postcodeResponse.ok) {
        const postcodeData = await postcodeResponse.json()
        if (postcodeData.result && postcodeData.result.length > 0) {
          postcode = postcodeData.result[0].postcode
        }
      }
    } catch (error) {
      console.error('Error fetching postcode:', error)
    }

    // 2. Look up MP
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

            stakeholders.push({
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

    // 3. Look up local council and ward using MapIt API
    try {
      const mapitResponse = await fetch(
        `https://mapit.mysociety.org/point/4326/${longitude},${latitude}?type=WMC,CTY,DIS,MTD,UTA,LBO,COI,LGD,DIW,MTW,UTW,LBW,UTE,UTS,CPC`
      )

      if (mapitResponse.ok) {
        const areas: Record<string, MapItArea> = await mapitResponse.json()

        for (const areaId in areas) {
          const area = areas[areaId]

          // Capture council name
          if (['DIS', 'MTD', 'UTA', 'LBO', 'CTY'].includes(area.type)) {
            councilName = area.name
          }

          // Capture ward name
          if (['DIW', 'MTW', 'UTW', 'LBW'].includes(area.type)) {
            wardName = area.name
          }

          // Add parish council if present
          if (area.type === 'CPC') {
            stakeholders.push({
              name: `${area.name} Parish Council`,
              organization: area.name,
              role: 'Parish Council',
              type: 'community_org',
              source: 'MapIt API',
              notes: `Parish councils handle local matters.`
            })
          }
        }
      }
    } catch (error) {
      console.error('Error fetching MapIt data:', error)
    }

    // 4. Look up councillors from database
    if (councilName && wardName) {
      try {
        const councillors = await findCouncillors(councilName, wardName)

        if (councillors.length > 0) {
          // Add each councillor individually
          for (const councillor of councillors) {
            stakeholders.push({
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
      }
    }

    return NextResponse.json({
      stakeholders,
      location: {
        latitude,
        longitude,
        postcode,
        council: councilName,
        ward: wardName
      }
    })
  } catch (error) {
    console.error('Error in stakeholder preview:', error)
    return NextResponse.json(
      { error: 'Failed to detect stakeholders' },
      { status: 500 }
    )
  }
}
