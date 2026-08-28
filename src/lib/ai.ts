import Anthropic from '@anthropic-ai/sdk'

// Lazy-load Anthropic client to avoid build-time errors
let anthropicClient: Anthropic | null = null

const MODEL = 'claude-opus-4-8'

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured — AI analysis is unavailable')
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

/**
 * Run a single analysis call: system prompt + user content, with the response
 * constrained to `schema` via structured outputs, so the returned JSON always
 * matches the expected shape.
 */
async function analysisCall<T>(options: {
  system: string
  user: string
  schema: Record<string, unknown>
  effort?: 'low' | 'medium' | 'high'
}): Promise<T> {
  const response = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: options.effort || 'low',
      format: { type: 'json_schema', schema: options.schema },
    },
    system: options.system,
    messages: [{ role: 'user', content: options.user }],
  })

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )
  if (!textBlock) {
    throw new Error(`AI analysis returned no text output (stop_reason: ${response.stop_reason})`)
  }
  return JSON.parse(textBlock.text) as T
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

// Input caps to protect against context-window blowups and unbounded cost.
// We analyze at most the MAX_ITEMS most recent items, and truncate each item's
// text to MAX_ITEM_CHARS before it's placed into any prompt.
const MAX_ITEMS = 400
const MAX_ITEM_CHARS = 1000

/**
 * Cap the feedback set for LLM analysis: keep at most MAX_ITEMS of the most
 * recent items (by createdAt, newest first) and truncate each item's content to
 * MAX_ITEM_CHARS. Returns a new array; input is left untouched. If the input was
 * larger than the caps we simply analyze the capped subset (no throw).
 */
function capFeedbackForAnalysis(feedbackItems: FeedbackItem[]): FeedbackItem[] {
  const recent = [...feedbackItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_ITEMS)

  return recent.map(item =>
    item.content.length > MAX_ITEM_CHARS
      ? { ...item, content: item.content.slice(0, MAX_ITEM_CHARS) }
      : item
  )
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

const SENTIMENT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    overall: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
    score: { type: 'number', description: 'From -1 (very negative) to 1 (very positive)' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'The bracket number of the feedback item' },
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          confidence: { type: 'number', description: '0 to 1' },
        },
        required: ['id', 'sentiment', 'confidence'],
      },
    },
  },
  required: ['overall', 'score', 'items'],
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

  const capped = capFeedbackForAnalysis(feedbackItems)

  const feedbackText = capped.map((item, i) =>
    `[${i + 1}] (${item.type}) ${item.content}`
  ).join('\n\n')

  const result = await analysisCall<{
    overall: SentimentResult['overall']
    score: number
    items: Array<{ id: string; sentiment: 'positive' | 'negative' | 'neutral'; confidence: number }>
  }>({
    system: `You are an expert at analyzing public feedback sentiment for planning and development projects.
Analyze the sentiment of each piece of feedback.

For each feedback item, determine if it's positive (supportive), negative (concerned/opposed), or neutral (informational/question). Return one item result per feedback item, using the number in brackets as the id.

Be accurate and consider the context of planning/development projects. Opposition or concerns = negative. Support or praise = positive.`,
    user: `Analyze the sentiment of this feedback:\n\n${feedbackText}`,
    schema: SENTIMENT_SCHEMA,
    effort: 'low',
  })

  // Map results back to original items, resolving each returned item to the
  // original feedback item by the bracket number (1-based index into `capped`).
  // We capture the resolved original alongside the mapped result so the
  // by-source aggregation attributes sentiment by the *actual* item — not by a
  // positional index, which breaks if the model reorders, drops, or adds items.
  const mapped = result.items.map(item => {
    const original = capped[parseInt(item.id) - 1]
    return {
      original,
      result: {
        id: original?.id || item.id,
        sentiment: item.sentiment,
        confidence: item.confidence,
      },
    }
  })

  const itemResults = mapped.map(m => m.result)

  // Guard: the model may not return exactly one result per input item. We don't
  // throw — we just aggregate over whatever resolved items we got.
  if (itemResults.length !== capped.length) {
    console.warn(
      `analyzeSentiment: model returned ${itemResults.length} items for ${capped.length} inputs`
    )
  }

  // Calculate breakdowns
  const breakdown = { positive: 0, negative: 0, neutral: 0 }
  const bySource = {
    pins: { positive: 0, negative: 0, neutral: 0 },
    forms: { positive: 0, negative: 0, neutral: 0 },
    enquiries: { positive: 0, negative: 0, neutral: 0 },
  }

  mapped.forEach(({ original, result: item }) => {
    // Skip results that didn't resolve to a real item so counts stay correct.
    if (!original) return

    breakdown[item.sentiment]++

    if (original.type === 'pin') bySource.pins[item.sentiment]++
    else if (original.type === 'form') bySource.forms[item.sentiment]++
    else if (original.type === 'enquiry') bySource.enquiries[item.sentiment]++
  })

  return {
    overall: result.overall,
    score: result.score,
    breakdown,
    bySource,
    items: itemResults,
  }
}

const THEMES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Short theme name, e.g. "Traffic Concerns"' },
          count: { type: 'integer', description: 'Number of feedback items mentioning this theme' },
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'mixed'] },
          sentimentBreakdown: {
            type: 'object',
            additionalProperties: false,
            properties: {
              positive: { type: 'integer' },
              negative: { type: 'integer' },
              neutral: { type: 'integer' },
            },
            required: ['positive', 'negative', 'neutral'],
          },
          keywords: { type: 'array', items: { type: 'string' }, description: '3-5 keywords' },
          sampleQuotes: {
            type: 'array',
            items: { type: 'string' },
            description: '1-2 short quotes (max 100 chars) exemplifying this theme',
          },
        },
        required: ['name', 'count', 'sentiment', 'sentimentBreakdown', 'keywords', 'sampleQuotes'],
      },
    },
  },
  required: ['themes'],
}

export async function extractThemes(feedbackItems: FeedbackItem[]): Promise<ThemesResult> {
  if (feedbackItems.length === 0) {
    return { themes: [], totalFeedback: 0 }
  }

  const capped = capFeedbackForAnalysis(feedbackItems)

  const feedbackText = capped.map((item, i) =>
    `[${i + 1}] ${item.content}`
  ).join('\n\n')

  const result = await analysisCall<{ themes: Required<Theme>[] }>({
    system: `You are an expert at identifying themes in public feedback for planning and development projects.
Analyze the feedback and extract the main themes/topics being discussed.

Identify 5-10 main themes. Be specific to planning/development contexts (traffic, parking, design, environment, community, housing, safety, etc.).
The sentimentBreakdown should reflect the actual split of positive/negative/neutral responses for that specific theme.`,
    user: `Extract themes from this feedback:\n\n${feedbackText}`,
    schema: THEMES_SCHEMA,
    effort: 'medium',
  })

  return {
    themes: result.themes.map(theme => ({
      name: theme.name,
      count: theme.count || 1,
      sentiment: theme.sentiment || 'neutral',
      sentimentBreakdown: theme.sentimentBreakdown || { positive: 0, negative: 0, neutral: theme.count || 1 },
      keywords: theme.keywords || [],
      sampleQuotes: (theme.sampleQuotes || []).slice(0, 2),
    })),
    totalFeedback: capped.length,
  }
}

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    executive: { type: 'string', description: '2-3 sentence executive summary' },
    keyFindings: { type: 'array', items: { type: 'string' }, description: '3-5 key findings' },
    recommendations: { type: 'array', items: { type: 'string' }, description: '2-3 actionable recommendations' },
    concernAreas: { type: 'array', items: { type: 'string' } },
    supportAreas: { type: 'array', items: { type: 'string' } },
  },
  required: ['executive', 'keyFindings', 'recommendations', 'concernAreas', 'supportAreas'],
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
  const feedbackSample = feedbackItems
    .slice(0, 20)
    .map(item => item.content.slice(0, MAX_ITEM_CHARS))
    .join('\n---\n')

  return analysisCall<SummaryResult>({
    system: `You are an expert at summarizing public consultation feedback for planning projects.
Write clear, actionable summaries that help project teams understand public sentiment.`,
    user: `Summarize this consultation feedback.

Total responses: ${feedbackItems.length}
Overall sentiment: ${sentiment.overall} (score: ${sentiment.score.toFixed(2)})
Sentiment breakdown: ${sentiment.breakdown.positive} positive, ${sentiment.breakdown.negative} negative, ${sentiment.breakdown.neutral} neutral
Top themes: ${topThemes}

Sample feedback:
${feedbackSample}`,
    schema: SUMMARY_SCHEMA,
    effort: 'medium',
  })
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

const MATERIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'object',
      additionalProperties: false,
      properties: {
        material: { type: 'integer' },
        nonMaterial: { type: 'integer' },
        mixed: { type: 'integer' },
      },
      required: ['material', 'nonMaterial', 'mixed'],
    },
    categories: {
      type: 'object',
      additionalProperties: false,
      properties: {
        material: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              count: { type: 'integer' },
              examples: { type: 'array', items: { type: 'string' }, description: 'Short quotes' },
            },
            required: ['name', 'count', 'examples'],
          },
        },
        nonMaterial: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              count: { type: 'integer' },
              examples: { type: 'array', items: { type: 'string' }, description: 'Short quotes' },
            },
            required: ['name', 'count', 'examples'],
          },
        },
      },
      required: ['material', 'nonMaterial'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'The bracket number of the feedback item' },
          classification: { type: 'string', enum: ['material', 'non-material', 'mixed'] },
          materialCategories: { type: 'array', items: { type: 'string' } },
          nonMaterialCategories: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'classification', 'materialCategories', 'nonMaterialCategories'],
      },
    },
  },
  required: ['summary', 'categories', 'items'],
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

  const capped = capFeedbackForAnalysis(feedbackItems)

  const feedbackText = capped.map((item, i) =>
    `[${i + 1}] ${item.content}`
  ).join('\n\n')

  const result = await analysisCall<MaterialAnalysisResult>({
    system: `You are a UK planning expert. Classify each consultation response based on whether it raises material planning considerations or non-material objections. Use the number in brackets as each item's id.

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
- "It's not fair" or "we don't want change" without material reason`,
    user: `Classify these consultation responses:\n\n${feedbackText}`,
    schema: MATERIAL_SCHEMA,
    effort: 'medium',
  })

  // Map item IDs (bracket numbers, 1-based into `capped`) back to actual feedback item IDs
  const items = result.items.map(item => ({
    id: capped[parseInt(item.id) - 1]?.id || item.id,
    classification: item.classification,
    materialCategories: item.materialCategories || [],
    nonMaterialCategories: item.nonMaterialCategories || [],
  }))

  return {
    summary: result.summary,
    categories: result.categories,
    items,
  }
}

const HEADLINE_STATS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stats: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', description: 'The headline statistic, one sentence, ~10-20 words' },
          type: { type: 'string', enum: ['concern', 'support', 'neutral', 'insight'] },
        },
        required: ['text', 'type'],
      },
    },
  },
  required: ['stats'],
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

  return analysisCall<HeadlineStatsResult>({
    system: `You are an expert at creating compelling, shareable statistics from consultation feedback.
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

Example formats:
- "62% of respondents raised traffic concerns, making it the top issue"
- "Housing need support outweighs opposition 3:1 among local residents"
- "38 residents specifically mentioned school-run congestion as a key worry"`,
    user: `Generate headline statistics from this consultation data:

Total responses: ${feedbackItems.length}
Overall sentiment: ${sentiment.overall} (score: ${sentiment.score.toFixed(2)})
Sentiment breakdown: ${sentiment.breakdown.positive} positive, ${sentiment.breakdown.negative} negative, ${sentiment.breakdown.neutral} neutral

Top themes:
${themeSummary}`,
    schema: HEADLINE_STATS_SCHEMA,
    effort: 'low',
  })
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
