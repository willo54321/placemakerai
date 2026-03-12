import OpenAI from 'openai'

// Lazy-load OpenAI client to avoid build-time errors
let openaiClient: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return openaiClient
}

export interface FeedbackItem {
  id: string
  type: 'pin' | 'form' | 'enquiry'
  content: string
  category?: string
  latitude?: number | null
  longitude?: number | null
  createdAt: Date
}

export interface SentimentResult {
  overall: 'positive' | 'negative' | 'neutral' | 'mixed'
  score: number // -1 to 1
  breakdown: {
    positive: number
    negative: number
    neutral: number
  }
  bySource: {
    pins: { positive: number; negative: number; neutral: number }
    forms: { positive: number; negative: number; neutral: number }
    enquiries: { positive: number; negative: number; neutral: number }
  }
  items: Array<{
    id: string
    sentiment: 'positive' | 'negative' | 'neutral'
    confidence: number
  }>
}

export interface ThemeSentimentBreakdown {
  positive: number
  negative: number
  neutral: number
}

export interface Theme {
  name: string
  count: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  keywords: string[]
  sampleQuotes: string[]
  sentimentBreakdown?: ThemeSentimentBreakdown
}

export interface ThemesResult {
  themes: Theme[]
  totalFeedback: number
}

export interface SummaryResult {
  executive: string
  keyFindings: string[]
  recommendations: string[]
  concernAreas: string[]
  supportAreas: string[]
}

export interface HeadlineStat {
  text: string
  type: 'concern' | 'support' | 'neutral' | 'insight'
}

export interface HeadlineStatsResult {
  stats: HeadlineStat[]
}

export interface MaterialClassification {
  classification: 'material' | 'non-material' | 'mixed'
  materialCategories: string[]
  nonMaterialCategories: string[]
  confidence: number
}

export interface MaterialAnalysisResult {
  summary: {
    material: number
    nonMaterial: number
    mixed: number
  }
  categories: {
    material: Array<{ name: string; count: number; examples: string[] }>
    nonMaterial: Array<{ name: string; count: number; examples: string[] }>
  }
  items: Array<{
    id: string
    classification: 'material' | 'non-material' | 'mixed'
    materialCategories: string[]
    nonMaterialCategories: string[]
  }>
}

export interface FullAnalysisResult {
  sentiment: SentimentResult
  themes: ThemesResult
  summary: SummaryResult
  headlineStats?: HeadlineStatsResult
  materialAnalysis?: MaterialAnalysisResult
  geographic?: {
    clusters: Array<{
      latitude: number
      longitude: number
      sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      count: number
      themes: string[]
    }>
  }
  analyzedAt: string
  feedbackCount: number
}

export async function analyzeSentiment(feedbackItems: FeedbackItem[]): Promise<SentimentResult> {
  if (feedbackItems.length === 0) {
    return {
      overall: 'neutral',
      score: 0,
      breakdown: { positive: 0, negative: 0, neutral: 0 },
      bySource: {
        pins: { positive: 0, negative: 0, neutral: 0 },
        forms: { positive: 0, negative: 0, neutral: 0 },
        enquiries: { positive: 0, negative: 0, neutral: 0 },
      },
      items: [],
    }
  }

  const feedbackText = feedbackItems.map((item, i) =>
    `[${i + 1}] (${item.type}) ${item.content}`
  ).join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at analyzing public feedback sentiment for planning and development projects.
Analyze the sentiment of each piece of feedback and provide a JSON response.

For each feedback item, determine if it's positive (supportive), negative (concerned/opposed), or neutral (informational/question).

Return a JSON object with:
- overall: "positive", "negative", "neutral", or "mixed"
- score: number from -1 (very negative) to 1 (very positive)
- items: array of {id: string (the number in brackets), sentiment: "positive"|"negative"|"neutral", confidence: 0-1}

Be accurate and consider the context of planning/development projects. Opposition or concerns = negative. Support or praise = positive.`
      },
      {
        role: 'user',
        content: `Analyze the sentiment of this feedback:\n\n${feedbackText}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  // Map results back to original items and calculate breakdowns
  const itemResults = (result.items || []).map((item: { id: string; sentiment: string; confidence: number }) => ({
    id: feedbackItems[parseInt(item.id) - 1]?.id || item.id,
    sentiment: item.sentiment as 'positive' | 'negative' | 'neutral',
    confidence: item.confidence,
  }))

  // Calculate breakdowns
  const breakdown = { positive: 0, negative: 0, neutral: 0 }
  const bySource = {
    pins: { positive: 0, negative: 0, neutral: 0 },
    forms: { positive: 0, negative: 0, neutral: 0 },
    enquiries: { positive: 0, negative: 0, neutral: 0 },
  }

  itemResults.forEach((item: { id: string; sentiment: 'positive' | 'negative' | 'neutral' }, i: number) => {
    const original = feedbackItems[i]
    if (!original) return

    breakdown[item.sentiment]++

    if (original.type === 'pin') bySource.pins[item.sentiment]++
    else if (original.type === 'form') bySource.forms[item.sentiment]++
    else if (original.type === 'enquiry') bySource.enquiries[item.sentiment]++
  })

  return {
    overall: result.overall || 'neutral',
    score: result.score || 0,
    breakdown,
    bySource,
    items: itemResults,
  }
}

export async function extractThemes(feedbackItems: FeedbackItem[]): Promise<ThemesResult> {
  if (feedbackItems.length === 0) {
    return { themes: [], totalFeedback: 0 }
  }

  const feedbackText = feedbackItems.map((item, i) =>
    `[${i + 1}] ${item.content}`
  ).join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at identifying themes in public feedback for planning and development projects.
Analyze the feedback and extract the main themes/topics being discussed.

Return a JSON object with:
- themes: array of objects with:
  - name: short theme name (e.g., "Traffic Concerns", "Environmental Impact", "Design Support")
  - count: number of feedback items mentioning this theme
  - sentiment: "positive", "negative", "neutral", or "mixed" based on overall sentiment for this theme
  - sentimentBreakdown: object with { positive: number, negative: number, neutral: number } showing how many responses for this theme are supportive, concerned, or neutral
  - keywords: array of 3-5 keywords related to this theme
  - sampleQuotes: array of 1-2 short quotes (max 100 chars) from feedback exemplifying this theme

Identify 5-10 main themes. Be specific to planning/development contexts (traffic, parking, design, environment, community, housing, safety, etc.).
The sentimentBreakdown should reflect the actual split of positive/negative/neutral responses for that specific theme.`
      },
      {
        role: 'user',
        content: `Extract themes from this feedback:\n\n${feedbackText}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  return {
    themes: (result.themes || []).map((theme: Theme) => ({
      name: theme.name,
      count: theme.count || 1,
      sentiment: theme.sentiment || 'neutral',
      sentimentBreakdown: theme.sentimentBreakdown || { positive: 0, negative: 0, neutral: theme.count || 1 },
      keywords: theme.keywords || [],
      sampleQuotes: (theme.sampleQuotes || []).slice(0, 2),
    })),
    totalFeedback: feedbackItems.length,
  }
}

export async function generateSummary(
  feedbackItems: FeedbackItem[],
  sentiment: SentimentResult,
  themes: ThemesResult
): Promise<SummaryResult> {
  if (feedbackItems.length === 0) {
    return {
      executive: 'No feedback has been received yet.',
      keyFindings: [],
      recommendations: [],
      concernAreas: [],
      supportAreas: [],
    }
  }

  const topThemes = themes.themes.slice(0, 5).map(t => `${t.name} (${t.sentiment})`).join(', ')
  const feedbackSample = feedbackItems.slice(0, 20).map(item => item.content).join('\n---\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert at summarizing public consultation feedback for planning projects.
Write clear, actionable summaries that help project teams understand public sentiment.

Return a JSON object with:
- executive: 2-3 sentence executive summary
- keyFindings: array of 3-5 key findings (short bullet points)
- recommendations: array of 2-3 actionable recommendations based on feedback
- concernAreas: array of main areas of concern raised
- supportAreas: array of aspects receiving support`
      },
      {
        role: 'user',
        content: `Summarize this consultation feedback.

Total responses: ${feedbackItems.length}
Overall sentiment: ${sentiment.overall} (score: ${sentiment.score.toFixed(2)})
Sentiment breakdown: ${sentiment.breakdown.positive} positive, ${sentiment.breakdown.negative} negative, ${sentiment.breakdown.neutral} neutral
Top themes: ${topThemes}

Sample feedback:
${feedbackSample}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  return {
    executive: result.executive || 'Analysis complete.',
    keyFindings: result.keyFindings || [],
    recommendations: result.recommendations || [],
    concernAreas: result.concernAreas || [],
    supportAreas: result.supportAreas || [],
  }
}

export async function analyzeGeographic(
  feedbackItems: FeedbackItem[]
): Promise<FullAnalysisResult['geographic']> {
  // Filter items with location data
  const locatedItems = feedbackItems.filter(
    item => item.latitude != null && item.longitude != null
  )

  if (locatedItems.length < 3) {
    return undefined
  }

  // Group by approximate location (round to 3 decimal places ~100m precision)
  const clusters = new Map<string, FeedbackItem[]>()

  locatedItems.forEach(item => {
    const key = `${item.latitude!.toFixed(3)},${item.longitude!.toFixed(3)}`
    if (!clusters.has(key)) {
      clusters.set(key, [])
    }
    clusters.get(key)!.push(item)
  })

  // Analyze each cluster
  const clusterResults: NonNullable<FullAnalysisResult['geographic']>['clusters'] = []

  for (const [key, items] of Array.from(clusters.entries())) {
    if (items.length < 1) continue

    const [lat, lng] = key.split(',').map(Number)

    // Simple sentiment count for cluster
    const sentiments = { positive: 0, negative: 0, neutral: 0 }

    // Use category as proxy for sentiment if available
    items.forEach(item => {
      if (item.category === 'positive' || item.category === 'support') {
        sentiments.positive++
      } else if (item.category === 'negative' || item.category === 'concern') {
        sentiments.negative++
      } else {
        sentiments.neutral++
      }
    })

    const dominant = Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0][0] as 'positive' | 'negative' | 'neutral'
    const isMixed = sentiments.positive > 0 && sentiments.negative > 0

    clusterResults.push({
      latitude: lat,
      longitude: lng,
      sentiment: isMixed ? 'mixed' : dominant,
      count: items.length,
      themes: [], // Would need theme extraction per cluster for this
    })
  }

  return { clusters: clusterResults }
}

export async function runFullAnalysis(feedbackItems: FeedbackItem[]): Promise<FullAnalysisResult> {
  // Run analyses in parallel where possible
  const [sentiment, themes, materialAnalysis] = await Promise.all([
    analyzeSentiment(feedbackItems),
    extractThemes(feedbackItems),
    classifyMaterialConsiderations(feedbackItems),
  ])

  // Summary and headline stats depend on sentiment and themes - run in parallel
  const [summary, headlineStats] = await Promise.all([
    generateSummary(feedbackItems, sentiment, themes),
    generateHeadlineStats(feedbackItems, sentiment, themes),
  ])

  // Geographic analysis
  const geographic = await analyzeGeographic(feedbackItems)

  return {
    sentiment,
    themes,
    summary,
    headlineStats,
    materialAnalysis,
    geographic,
    analyzedAt: new Date().toISOString(),
    feedbackCount: feedbackItems.length,
  }
}

export async function classifyMaterialConsiderations(
  feedbackItems: FeedbackItem[]
): Promise<MaterialAnalysisResult> {
  if (feedbackItems.length === 0) {
    return {
      summary: { material: 0, nonMaterial: 0, mixed: 0 },
      categories: { material: [], nonMaterial: [] },
      items: [],
    }
  }

  const feedbackText = feedbackItems.map((item, i) =>
    `[${i + 1}] ${item.content}`
  ).join('\n\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a UK planning expert. Classify each consultation response based on whether it raises material planning considerations or non-material objections.

MATERIAL PLANNING CONSIDERATIONS (things the planning authority CAN consider):
- Traffic/highways impact, parking, road safety
- Noise, air quality, light pollution
- Design, visual impact, character of area
- Overlooking, privacy, overshadowing
- Ecology, wildlife, trees, biodiversity
- Heritage, listed buildings, conservation areas
- Flood risk, drainage, contamination
- Infrastructure capacity (schools, healthcare, utilities)
- Affordable housing provision
- Economic benefits, employment

NON-MATERIAL OBJECTIONS (things the planning authority CANNOT consider):
- Property values, house prices
- Loss of private view (not same as visual impact on area)
- Competition between businesses
- Construction disruption (covered by other legislation)
- Applicant's motives or personal circumstances
- Restrictive covenants, boundary disputes
- Moral/political objections to developer
- "It's not fair" or "we don't want change" without material reason

Return a JSON object with:
- summary: { material: count, nonMaterial: count, mixed: count }
- categories: {
    material: [{ name: "Traffic Impact", count: number, examples: ["short quote"] }],
    nonMaterial: [{ name: "Property Values", count: number, examples: ["short quote"] }]
  }
- items: [{ id: "1", classification: "material"|"non-material"|"mixed", materialCategories: [], nonMaterialCategories: [] }]`
      },
      {
        role: 'user',
        content: `Classify these consultation responses:\n\n${feedbackText}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  // Map item IDs back to actual feedback item IDs
  const items = (result.items || []).map((item: { id: string; classification: string; materialCategories: string[]; nonMaterialCategories: string[] }) => ({
    id: feedbackItems[parseInt(item.id) - 1]?.id || item.id,
    classification: item.classification as 'material' | 'non-material' | 'mixed',
    materialCategories: item.materialCategories || [],
    nonMaterialCategories: item.nonMaterialCategories || [],
  }))

  return {
    summary: result.summary || { material: 0, nonMaterial: 0, mixed: 0 },
    categories: result.categories || { material: [], nonMaterial: [] },
    items,
  }
}

export async function generateHeadlineStats(
  feedbackItems: FeedbackItem[],
  sentiment: SentimentResult,
  themes: ThemesResult
): Promise<HeadlineStatsResult> {
  if (feedbackItems.length === 0) {
    return { stats: [] }
  }

  const topThemes = themes.themes.slice(0, 5)
  const themeSummary = topThemes.map(t => {
    const breakdown = t.sentimentBreakdown || { positive: 0, negative: 0, neutral: 0 }
    return `${t.name}: ${t.count} mentions (${breakdown.positive} positive, ${breakdown.negative} negative)`
  }).join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert at creating compelling, shareable statistics from consultation feedback.
Generate 4-6 headline statistics that would be useful for:
- Planning committee reports
- Social media sharing
- Press releases
- Community updates

Each stat should be:
- Specific and data-driven (include numbers/percentages)
- Concise (one sentence, ~10-20 words)
- Impactful and newsworthy
- Based on actual data provided

Return a JSON object with:
- stats: array of objects with:
  - text: the headline statistic text
  - type: "concern" (negative finding), "support" (positive finding), "neutral" (factual), or "insight" (interesting pattern)

Example formats:
- "62% of respondents raised traffic concerns, making it the top issue"
- "Housing need support outweighs opposition 3:1 among local residents"
- "38 residents specifically mentioned school-run congestion as a key worry"`
      },
      {
        role: 'user',
        content: `Generate headline statistics from this consultation data:

Total responses: ${feedbackItems.length}
Overall sentiment: ${sentiment.overall} (score: ${sentiment.score.toFixed(2)})
Sentiment breakdown: ${sentiment.breakdown.positive} positive, ${sentiment.breakdown.negative} negative, ${sentiment.breakdown.neutral} neutral

Top themes:
${themeSummary}`
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  return {
    stats: (result.stats || []).map((stat: HeadlineStat) => ({
      text: stat.text,
      type: stat.type || 'neutral',
    })),
  }
}

// Helper to create hash of feedback for change detection
export function createFeedbackHash(feedbackItems: FeedbackItem[]): string {
  const content = feedbackItems
    .map(item => `${item.id}:${item.content}`)
    .sort()
    .join('|')

  // Simple hash function
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(36)
}
