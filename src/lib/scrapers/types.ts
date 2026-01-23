// Types for council scraping

export interface ScrapedCouncillor {
  name: string
  title?: string
  firstName?: string
  lastName?: string
  party?: string
  wardName: string
  email?: string
  phone?: string
  profileUrl?: string
  photoUrl?: string
  cabinetRole?: string
  committees?: string
}

export interface ScrapeResult {
  success: boolean
  councillors: ScrapedCouncillor[]
  error?: string
  partialData?: boolean
}

export interface CouncilConfig {
  name: string
  mapitName: string
  type: 'district' | 'county' | 'unitary' | 'metropolitan' | 'london_borough'
  website: string
  councillorsUrl: string
  scraperType: 'moderngov' | 'westminster' | 'custom'
  gssCode?: string
}

// Pre-configured councils for scraping
export const COUNCIL_CONFIGS: CouncilConfig[] = [
  // London Boroughs
  {
    name: 'Westminster City Council',
    mapitName: 'Westminster City Council',
    type: 'london_borough',
    website: 'https://www.westminster.gov.uk',
    councillorsUrl: 'https://www.westminster.gov.uk/councillors',
    scraperType: 'westminster',
    gssCode: 'E09000033'
  },
  {
    name: 'Camden Council',
    mapitName: 'Camden',
    type: 'london_borough',
    website: 'https://www.camden.gov.uk',
    councillorsUrl: 'https://democracy.camden.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000007'
  },
  {
    name: 'Islington Council',
    mapitName: 'Islington',
    type: 'london_borough',
    website: 'https://www.islington.gov.uk',
    councillorsUrl: 'https://democracy.islington.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000019'
  },
  {
    name: 'Hackney Council',
    mapitName: 'Hackney',
    type: 'london_borough',
    website: 'https://hackney.gov.uk',
    councillorsUrl: 'https://mginternet.hackney.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000012'
  },
  {
    name: 'Tower Hamlets Council',
    mapitName: 'Tower Hamlets',
    type: 'london_borough',
    website: 'https://www.towerhamlets.gov.uk',
    councillorsUrl: 'https://democracy.towerhamlets.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000030'
  },
  {
    name: 'Southwark Council',
    mapitName: 'Southwark',
    type: 'london_borough',
    website: 'https://www.southwark.gov.uk',
    councillorsUrl: 'https://moderngov.southwark.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000028'
  },
  {
    name: 'Lambeth Council',
    mapitName: 'Lambeth',
    type: 'london_borough',
    website: 'https://www.lambeth.gov.uk',
    councillorsUrl: 'https://moderngov.lambeth.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E09000022'
  },
  // District councils
  {
    name: 'Mole Valley District Council',
    mapitName: 'Mole Valley District Council',
    type: 'district',
    website: 'https://www.molevalley.gov.uk',
    councillorsUrl: 'https://molevalley.moderngov.co.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E07000210'
  },
  {
    name: 'Guildford Borough Council',
    mapitName: 'Guildford',
    type: 'district',
    website: 'https://www.guildford.gov.uk',
    councillorsUrl: 'https://www2.guildford.gov.uk/councilmeetings/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E07000209'
  },
  // Unitary authorities
  {
    name: 'Brighton and Hove City Council',
    mapitName: 'Brighton and Hove City Council',
    type: 'unitary',
    website: 'https://www.brighton-hove.gov.uk',
    councillorsUrl: 'https://democracy.brighton-hove.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E06000043'
  },
  {
    name: 'Bristol City Council',
    mapitName: 'Bristol, City of',
    type: 'unitary',
    website: 'https://www.bristol.gov.uk',
    councillorsUrl: 'https://democracy.bristol.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E06000023'
  },
  {
    name: 'Manchester City Council',
    mapitName: 'Manchester City Council',
    type: 'metropolitan',
    website: 'https://www.manchester.gov.uk',
    councillorsUrl: 'https://democracy.manchester.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E08000003'
  },
  {
    name: 'Birmingham City Council',
    mapitName: 'Birmingham City Council',
    type: 'metropolitan',
    website: 'https://www.birmingham.gov.uk',
    councillorsUrl: 'https://birmingham.cmis.uk.com/birmingham/Councillors.aspx',
    scraperType: 'moderngov',
    gssCode: 'E08000025'
  },
  {
    name: 'Leeds City Council',
    mapitName: 'Leeds City Council',
    type: 'metropolitan',
    website: 'https://www.leeds.gov.uk',
    councillorsUrl: 'https://democracy.leeds.gov.uk/mgMemberIndex.aspx',
    scraperType: 'moderngov',
    gssCode: 'E08000035'
  },
]
