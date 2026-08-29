import Anthropic from '@anthropic-ai/sdk'
import {
  crossReference,
  describeHighlight,
  type CrossReferenceResult,
} from '@/lib/cross-reference'
import { clusterResponses } from './campaign-detection'

// Lazy-load Anthropic client to avoid build-time errors
let anthropicClient: Anthropic | null = null

const MODEL = 'claude-opus-4-8'
// Per-item classification is high-volume and mechanical — it applies a fixed
// taxonomy rather than reasoning openly — so it is named separately from the
// reasoning calls and can be pointed at a cheaper model without touching them.
const CLASSIFIER_MODEL = MODEL

function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured — AI analysis is unavailable')
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      // Identity-linked API keys must declare which workspace each request
      // acts in; workspace-scoped keys don't need this and can leave it unset.
      defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
        ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID }
        : undefined,
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
  model?: string
  /**
   * Cache the system block. Worth setting wherever one system prompt is reused
   * across many calls in a single analysis — the batched classifiers send the
   * same instructions and taxonomy every time, so caching turns a repeated
   * prefix into a cache read instead of re-billed input.
   */
  cacheSystem?: boolean
}): Promise<T> {
  const response = await getAnthropic().messages.create({
    model: options.model || MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: options.effort || 'low',
      format: { type: 'json_schema', schema: options.schema },
    },
    system: options.cacheSystem
      ? [{ type: 'text', text: options.system, cache_control: { type: 'ephemeral' } }]
      : options.system,
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

// Each item's text is truncated before it reaches a prompt. Themes and stance
// are almost always apparent in the opening lines, so this costs little.
const MAX_ITEM_CHARS = 1000

/**
 * Hard ceiling on how many responses a single analysis will classify. This is a
 * cost and wall-clock guard, not a sampling strategy — when it bites, the
 * shortfall is reported in `coverage` rather than hidden, and the subset taken
 * is spread evenly across the whole consultation rather than skewed to whoever
 * responded most recently.
 */
const MAX_ANALYSIS_ITEMS = 5000

/** Responses per classification request. */
const CLASSIFY_BATCH_SIZE = 100

/** Classification requests in flight at once. */
const CLASSIFY_CONCURRENCY = 5

/** Responses shown to the model when it proposes the theme list. */
const TAXONOMY_SAMPLE_SIZE = 250

/** How much of a response to quote back in a report. */
const QUOTE_CHARS = 160

export interface AnalysisCoverage {
  /** Responses available. */
  total: number
  /** Responses actually classified. */
  analyzed: number
  /** True when every response was classified. */
  complete: boolean
  /** Present only when `complete` is false — say this out loud in the UI. */
  note?: string
}

/**
 * Take an evenly spaced subset across the whole array. Used only when a corpus
 * exceeds MAX_ANALYSIS_ITEMS: sampling across the full range keeps early and
 * late responses proportionally represented, where taking the newest N would
 * hand the entire summary to whoever organised the most recent push.
 */
function evenlySpacedSample<T>(values: T[], limit: number): T[] {
  if (values.length <= limit) return values

  const step = values.length / limit
  const out: T[] = []
  for (let i = 0; i < limit; i++) {
    out.push(values[Math.floor(i * step)])
  }
  return out
}

/**
 * Choose what to analyse and record how much of the corpus that covers.
 * Ordered oldest-first so downstream time splits are meaningful.
 */
function selectForAnalysis(feedbackItems: FeedbackItem[]): {
  items: FeedbackItem[]
  coverage: AnalysisCoverage
} {
  const chronological = [...feedbackItems].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  const selected = evenlySpacedSample(chronological, MAX_ANALYSIS_ITEMS).map(item =>
    item.content.length > MAX_ITEM_CHARS
      ? { ...item, content: item.content.slice(0, MAX_ITEM_CHARS) }
      : item
  )

  const complete = selected.length === chronological.length

  return {
    items: selected,
    coverage: {
      total: chronological.length,
      analyzed: selected.length,
      complete,
      note: complete
        ? undefined
        : `Analysed an evenly spaced sample of ${selected.length} of ${chronological.length} responses.`,
    },
  }
}

/** Split into fixed-size chunks. */
function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size))
  }
  return out
}

/**
 * Run an async mapper over a list with a bounded number of calls in flight.
 * Results keep input order. A failed chunk rejects the whole run — a partial
 * analysis silently missing a slice of responses would be worse than an error.
 */
async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  fn: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++
      results[index] = await fn(values[index], index)
    }
  })

  await Promise.all(workers)
  return results
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

export interface DetectedCampaign {
  label: string
  count: number
  stance: 'support' | 'oppose' | 'mixed' | 'unclear'
  /** What the shared template says, in 1-2 sentences */
  templateSummary: string
  /** What respondents added or changed beyond the template, if anything */
  personalAdditions: string
  /** Whether members are identical copies or edited variants */
  exact: boolean
  sampleQuote: string
  /** Ids of the responses in this campaign (capped) */
  memberIds: string[]
}

export interface CampaignAnalysisResult {
  totalAnalyzed: number
  /** Responses that are part of a template/campaign cluster */
  templatedCount: number
  /** Responses with no detected duplicate or template relationship */
  uniqueCount: number
  campaigns: DetectedCampaign[]
}

export interface FullAnalysisResult {
  sentiment: SentimentResult
  themes: ThemesResult
  summary: SummaryResult
  headlineStats?: HeadlineStatsResult
  materialAnalysis?: MaterialAnalysisResult
  campaignAnalysis?: CampaignAnalysisResult
  geographic?: {
    clusters: Array<{
      latitude: number
      longitude: number
      sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
      count: number
      themes: string[]
    }>
  }
  /** Statistically tested theme × segment patterns. */
  crossReference?: CrossReferenceResult
  /** How much of the corpus this analysis actually covers. Surface it. */
  coverage?: AnalysisCoverage
  analyzedAt: string
  feedbackCount: number
}

const TAXONOMY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', description: 'Short theme name, e.g. "Traffic and highways"' },
          description: {
            type: 'string',
            description: 'One sentence defining exactly what belongs under this theme',
          },
          keywords: { type: 'array', items: { type: 'string' }, description: '3-5 keywords' },
        },
        required: ['name', 'description', 'keywords'],
      },
    },
  },
  required: ['themes'],
}

const CLASSIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'The bracket number of the response' },
          sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          confidence: { type: 'number', description: '0 to 1' },
          themes: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Numbers of every theme that applies. Empty if none do.',
          },
        },
        required: ['id', 'sentiment', 'confidence', 'themes'],
      },
    },
  },
  required: ['items'],
}

/** A theme in the taxonomy the whole corpus is classified against. */
export interface ThemeDefinition {
  name: string
  description: string
  keywords: string[]
}

export interface ItemAssignment {
  /** The original FeedbackItem id. */
  id: string
  sentiment: 'positive' | 'negative' | 'neutral'
  confidence: number
  /** Indices into the taxonomy. */
  themeIds: number[]
}

export interface CorpusClassification {
  taxonomy: ThemeDefinition[]
  assignments: ItemAssignment[]
  /** The items actually classified, post-truncation. */
  items: FeedbackItem[]
  coverage: AnalysisCoverage
}

/**
 * Propose the theme list the whole corpus will then be classified against.
 *
 * Only a sample reaches the model here, because naming the themes is a
 * judgement about the shape of the debate rather than a count — but the sample
 * is spread evenly across the consultation's full timespan, so a late campaign
 * cannot invent a theme that nobody raised in the first three weeks.
 */
export async function discoverThemes(items: FeedbackItem[]): Promise<ThemeDefinition[]> {
  if (items.length === 0) return []

  const sample = evenlySpacedSample(items, TAXONOMY_SAMPLE_SIZE)
  const sampleText = sample.map((item, i) => `[${i + 1}] ${item.content}`).join('\n\n')

  const result = await analysisCall<{ themes: ThemeDefinition[] }>({
    system: `You are an expert at identifying themes in public feedback on planning and development projects.

Propose a set of themes that the full body of responses can then be sorted into. Aim for 6 to 12 themes.

Requirements:
- Themes must be specific to planning and development (traffic, parking, design, environment, housing mix, safety, construction impact, and so on) rather than generic sentiment labels.
- Themes must not overlap. Every theme needs a one-sentence description precise enough that two people sorting the same response would put it in the same place.
- Cover the substance of what is actually raised. Do not invent themes to be comprehensive, and do not collapse genuinely distinct concerns into one broad theme.`,
    user: `Propose themes for this consultation. This is a representative sample of the responses:\n\n${sampleText}`,
    schema: TAXONOMY_SCHEMA,
    effort: 'medium',
  })

  return result.themes.map(theme => ({
    name: theme.name,
    description: theme.description || '',
    keywords: theme.keywords || [],
  }))
}

/**
 * Classify every response against the taxonomy: stance plus which themes it
 * raises.
 *
 * This is the pass that makes the numbers real. Because each response is
 * classified exactly once, downstream theme counts and sentiment splits are
 * counted rather than estimated, and they can be traced back to the individual
 * responses behind them.
 */
export async function classifyCorpus(
  feedbackItems: FeedbackItem[]
): Promise<CorpusClassification> {
  const { items, coverage } = selectForAnalysis(feedbackItems)

  if (items.length === 0) {
    return { taxonomy: [], assignments: [], items: [], coverage }
  }

  const taxonomy = await discoverThemes(items)
  if (taxonomy.length === 0) {
    return { taxonomy: [], assignments: [], items, coverage }
  }

  const taxonomyText = taxonomy
    .map((theme, i) => `${i + 1}. ${theme.name} — ${theme.description}`)
    .join('\n')

  // Identical for every batch, so it is worth caching: the taxonomy and the
  // instructions are re-sent with each request and would otherwise be re-billed
  // once per batch.
  const system = `You are an expert at analysing public consultation responses on planning and development projects.

For each response, decide two things.

STANCE — positive if it supports or praises, negative if it opposes or raises concerns, neutral if it only asks a question or gives information. Judge the response's position on the proposal, not the tone of its language: a politely worded objection is negative.

THEMES — which of the numbered themes below the response raises. A response may raise several themes, or none. Assign a theme only when the response genuinely addresses it; do not stretch to give every response a theme.

THEMES:
${taxonomyText}

Return exactly one result per response, using the number in brackets as the id.`

  const batches = chunk(items, CLASSIFY_BATCH_SIZE)

  const batchResults = await mapWithConcurrency(batches, CLASSIFY_CONCURRENCY, async batch => {
    const batchText = batch
      .map((item, i) => `[${i + 1}] (${item.type}) ${item.content}`)
      .join('\n\n')

    const result = await analysisCall<{
      items: Array<{
        id: string
        sentiment: 'positive' | 'negative' | 'neutral'
        confidence: number
        themes: number[]
      }>
    }>({
      system,
      user: `Classify these responses:\n\n${batchText}`,
      schema: CLASSIFY_SCHEMA,
      effort: 'low',
      model: CLASSIFIER_MODEL,
      cacheSystem: true,
    })

    // Resolve by bracket number rather than position: the model may reorder,
    // drop, or repeat entries, and a positional read would then attribute one
    // resident's view to another.
    const seen = new Set<string>()
    const assignments: ItemAssignment[] = []

    result.items.forEach(entry => {
      const original = batch[parseInt(entry.id, 10) - 1]
      if (!original || seen.has(original.id)) return
      seen.add(original.id)

      assignments.push({
        id: original.id,
        sentiment: entry.sentiment,
        confidence: entry.confidence,
        themeIds: (entry.themes || [])
          // Model-supplied indices are 1-based and can be out of range.
          .map(n => n - 1)
          .filter(index => index >= 0 && index < taxonomy.length),
      })
    })

    if (assignments.length !== batch.length) {
      console.warn(
        `classifyCorpus: resolved ${assignments.length} of ${batch.length} responses in a batch`
      )
    }

    return assignments
  })

  const assignments = batchResults.flat()

  // Anything the model failed to return is missing from the counts, so the
  // coverage figure has to reflect what was actually classified, not what was
  // sent.
  const classified: AnalysisCoverage = {
    ...coverage,
    analyzed: assignments.length,
    complete: coverage.complete && assignments.length === items.length,
  }
  if (!classified.complete && !classified.note) {
    classified.note = `Classified ${assignments.length} of ${coverage.total} responses.`
  }

  return { taxonomy, assignments, items, coverage: classified }
}

/** Aggregate a classification into the sentiment shape. All counts are exact. */
export function deriveSentiment(classification: CorpusClassification): SentimentResult {
  const empty: SentimentResult = {
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

  if (classification.assignments.length === 0) return empty

  const itemsById = new Map(classification.items.map(item => [item.id, item]))
  const breakdown = { positive: 0, negative: 0, neutral: 0 }
  const bySource = {
    pins: { positive: 0, negative: 0, neutral: 0 },
    forms: { positive: 0, negative: 0, neutral: 0 },
    enquiries: { positive: 0, negative: 0, neutral: 0 },
  }

  classification.assignments.forEach(assignment => {
    breakdown[assignment.sentiment]++

    const item = itemsById.get(assignment.id)
    if (!item) return
    if (item.type === 'pin') bySource.pins[assignment.sentiment]++
    else if (item.type === 'form') bySource.forms[assignment.sentiment]++
    else if (item.type === 'enquiry') bySource.enquiries[assignment.sentiment]++
  })

  const total = classification.assignments.length
  const score = (breakdown.positive - breakdown.negative) / total

  // "Mixed" is a real finding in consultation — a genuinely divided response is
  // different from an indifferent one, and collapsing the two hides the split.
  const divided =
    breakdown.positive / total >= 0.25 && breakdown.negative / total >= 0.25

  let overall: SentimentResult['overall']
  if (divided) overall = 'mixed'
  else if (breakdown.positive > breakdown.negative && breakdown.positive >= breakdown.neutral)
    overall = 'positive'
  else if (breakdown.negative > breakdown.positive && breakdown.negative >= breakdown.neutral)
    overall = 'negative'
  else overall = 'neutral'

  return {
    overall,
    score,
    breakdown,
    bySource,
    items: classification.assignments.map(a => ({
      id: a.id,
      sentiment: a.sentiment,
      confidence: a.confidence,
    })),
  }
}

/**
 * Aggregate a classification into themes.
 *
 * Counts and sentiment splits are tallied from the per-response assignments,
 * and the quotes are the actual text of responses filed under each theme —
 * so a quote in a report can always be traced to the person who wrote it.
 */
export function deriveThemes(classification: CorpusClassification): ThemesResult {
  const { taxonomy, assignments, items } = classification
  if (taxonomy.length === 0 || assignments.length === 0) {
    return { themes: [], totalFeedback: assignments.length }
  }

  const itemsById = new Map(items.map(item => [item.id, item]))

  const themes: Theme[] = taxonomy.map((definition, themeId) => {
    const members = assignments.filter(a => a.themeIds.includes(themeId))
    const sentimentBreakdown = { positive: 0, negative: 0, neutral: 0 }
    members.forEach(member => sentimentBreakdown[member.sentiment]++)

    // Prefer quotes with enough substance to stand alone, shortest first so
    // they read cleanly in a report.
    const sampleQuotes = members
      .map(member => itemsById.get(member.id)?.content?.trim())
      .filter((text): text is string => !!text && text.length >= 40)
      .sort((a, b) => a.length - b.length)
      .slice(0, 2)
      .map(text => (text.length > QUOTE_CHARS ? `${text.slice(0, QUOTE_CHARS).trimEnd()}…` : text))

    const count = members.length
    const divided =
      count > 0 &&
      sentimentBreakdown.positive / count >= 0.25 &&
      sentimentBreakdown.negative / count >= 0.25

    let sentiment: Theme['sentiment']
    if (divided) sentiment = 'mixed'
    else if (sentimentBreakdown.negative > sentimentBreakdown.positive) sentiment = 'negative'
    else if (sentimentBreakdown.positive > sentimentBreakdown.negative) sentiment = 'positive'
    else sentiment = 'neutral'

    return {
      name: definition.name,
      count,
      sentiment,
      sentimentBreakdown,
      keywords: definition.keywords,
      sampleQuotes,
    }
  })

  return {
    // Themes nobody actually raised are noise in a report.
    themes: themes.filter(theme => theme.count > 0).sort((a, b) => b.count - a.count),
    totalFeedback: assignments.length,
  }
}

/**
 * Standalone sentiment analysis. Runs the full classification pass; prefer
 * `runFullAnalysis` when themes are wanted too, so the corpus is classified once.
 */
export async function analyzeSentiment(feedbackItems: FeedbackItem[]): Promise<SentimentResult> {
  if (feedbackItems.length === 0) {
    return deriveSentiment({ taxonomy: [], assignments: [], items: [], coverage: { total: 0, analyzed: 0, complete: true } })
  }
  return deriveSentiment(await classifyCorpus(feedbackItems))
}

/**
 * Standalone theme extraction. Runs the full classification pass; prefer
 * `runFullAnalysis` when sentiment is wanted too, so the corpus is classified once.
 */
export async function extractThemes(feedbackItems: FeedbackItem[]): Promise<ThemesResult> {
  if (feedbackItems.length === 0) return { themes: [], totalFeedback: 0 }
  return deriveThemes(await classifyCorpus(feedbackItems))
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
  themes: ThemesResult,
  /**
   * Pre-tested cross-reference findings. Passed in as statements rather than
   * raw data so the model reports patterns that survived significance testing
   * instead of inferring its own from a sample.
   */
  highlights: string[] = []
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
${
  highlights.length > 0
    ? `\nVerified patterns (already significance-tested — treat these as established fact and do not restate them as uncertain):\n${highlights.map(h => `- ${h}`).join('\n')}\n`
    : ''
}
Sample feedback:
${feedbackSample}`,
    schema: SUMMARY_SCHEMA,
    effort: 'medium',
  })
}

/**
 * Group located responses and describe each cluster.
 *
 * Sentiment here comes from the classification pass rather than the pin's
 * `category` field: the category is what the visitor picked from a dropdown,
 * which is often not what they went on to write. Themes are the ones actually
 * raised in that cluster, which is what makes "objections concentrate on the
 * northern boundary" a statement a map can show.
 */
export function deriveGeographic(
  classification: CorpusClassification
): FullAnalysisResult['geographic'] {
  const located = classification.items.filter(
    item => item.latitude != null && item.longitude != null
  )
  if (located.length < 3) return undefined

  const assignmentsById = new Map(classification.assignments.map(a => [a.id, a]))

  // ~100m precision, matching the clustering convention used elsewhere.
  const clusters = new Map<string, FeedbackItem[]>()
  located.forEach(item => {
    const key = `${item.latitude!.toFixed(3)},${item.longitude!.toFixed(3)}`
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key)!.push(item)
  })

  const clusterResults: NonNullable<FullAnalysisResult['geographic']>['clusters'] = []

  Array.from(clusters.entries()).forEach(([key, items]) => {
    const [latitude, longitude] = key.split(',').map(Number)

    const sentiments = { positive: 0, negative: 0, neutral: 0 }
    const themeCounts = new Map<number, number>()

    items.forEach(item => {
      const assignment = assignmentsById.get(item.id)
      if (!assignment) return

      sentiments[assignment.sentiment]++
      assignment.themeIds.forEach(themeId => {
        themeCounts.set(themeId, (themeCounts.get(themeId) || 0) + 1)
      })
    })

    const dominant = (Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0][0]) as
      | 'positive'
      | 'negative'
      | 'neutral'
    const mixed = sentiments.positive > 0 && sentiments.negative > 0

    const themes = Array.from(themeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([themeId]) => classification.taxonomy[themeId]?.name)
      .filter((name): name is string => !!name)

    clusterResults.push({
      latitude,
      longitude,
      sentiment: mixed ? 'mixed' : dominant,
      count: items.length,
      themes,
    })
  })

  return { clusters: clusterResults.sort((a, b) => b.count - a.count) }
}

/**
 * Standalone geographic analysis. Runs the classification pass; prefer
 * `runFullAnalysis`, which classifies the corpus once and reuses it.
 */
export async function analyzeGeographic(
  feedbackItems: FeedbackItem[]
): Promise<FullAnalysisResult['geographic']> {
  const located = feedbackItems.filter(item => item.latitude != null && item.longitude != null)
  if (located.length < 3) return undefined

  return deriveGeographic(await classifyCorpus(feedbackItems))
}

const CAMPAIGN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaigns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          clusterNumber: { type: 'integer', description: 'The cluster number this campaign corresponds to' },
          label: { type: 'string', description: 'Short name for the campaign, e.g. "Save the Meadow template letter"' },
          stance: { type: 'string', enum: ['support', 'oppose', 'mixed', 'unclear'] },
          templateSummary: { type: 'string', description: '1-2 sentences: what the shared template argues' },
          personalAdditions: {
            type: 'string',
            description: 'What respondents personally added or changed beyond the template; empty string if members are identical copies',
          },
          additionalVariantNumbers: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Bracket numbers of UNCLUSTERED responses that are paraphrased variants of this same template',
          },
        },
        required: ['clusterNumber', 'label', 'stance', 'templateSummary', 'personalAdditions', 'additionalVariantNumbers'],
      },
    },
  },
  required: ['campaigns'],
}

// Caps for the characterisation prompt. Clustering itself runs over ALL items
// in code; only cluster samples and an unclustered subset reach the model.
const MAX_CLUSTERS_TO_CHARACTERIZE = 10
const MAX_UNCLUSTERED_FOR_VARIANT_SCAN = 120
const CAMPAIGN_SAMPLE_CHARS = 1200
const VARIANT_SCAN_CHARS = 300
const MAX_STORED_MEMBER_IDS = 100

/**
 * Detect organised campaigns and duplicate responses. Near-identical texts are
 * clustered in code (zero token cost, full corpus); Claude then characterises
 * each cluster and scans a sample of unclustered responses for paraphrased
 * variants of the same templates.
 */
export async function analyzeCampaigns(
  feedbackItems: FeedbackItem[]
): Promise<CampaignAnalysisResult> {
  const total = feedbackItems.length
  const empty: CampaignAnalysisResult = {
    totalAnalyzed: total,
    templatedCount: 0,
    uniqueCount: total,
    campaigns: [],
  }
  if (total < 2) return empty

  const clusters = clusterResponses(
    feedbackItems.map(item => ({ id: item.id, content: item.content }))
  )
  if (clusters.length === 0) return empty

  const byId = new Map(feedbackItems.map(item => [item.id, item]))
  const clusteredIds = new Set(clusters.flatMap(c => c.memberIds))
  const topClusters = clusters.slice(0, MAX_CLUSTERS_TO_CHARACTERIZE)

  const clusterText = topClusters
    .map((cluster, i) => {
      const rep = byId.get(cluster.representativeId)!
      const variant = cluster.exact
        ? null
        : byId.get(cluster.memberIds[cluster.memberIds.length - 1])
      return [
        `CLUSTER ${i + 1} — ${cluster.memberIds.length} responses, ${cluster.exact ? 'identical copies' : 'near-identical variants'}`,
        `Representative text: ${rep.content.slice(0, CAMPAIGN_SAMPLE_CHARS)}`,
        variant && variant.id !== rep.id
          ? `A variant: ${variant.content.slice(0, CAMPAIGN_SAMPLE_CHARS)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  // Unclustered responses get scanned for paraphrased variants that shingle
  // similarity can't catch. Longest first — template rewrites are rarely short.
  const unclustered = feedbackItems
    .filter(item => !clusteredIds.has(item.id))
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, MAX_UNCLUSTERED_FOR_VARIANT_SCAN)
  const unclusteredText = unclustered
    .map((item, i) => `[${i + 1}] ${item.content.slice(0, VARIANT_SCAN_CHARS)}`)
    .join('\n')

  const result = await analysisCall<{
    campaigns: Array<{
      clusterNumber: number
      label: string
      stance: DetectedCampaign['stance']
      templateSummary: string
      personalAdditions: string
      additionalVariantNumbers: number[]
    }>
  }>({
    system: `You are an expert consultation analyst. Groups of near-identical responses have been detected in a public consultation — these are likely organised campaigns (template letters, copy-paste objections or support drives).

For each cluster: give it a short label, determine its stance toward the project, summarise what the shared template argues, and describe what (if anything) individual respondents added beyond the template.

Then check the UNCLUSTERED responses: if any are clearly a paraphrased or rewritten variant of one of the cluster templates (same campaign, reworded), list their bracket numbers under that campaign's additionalVariantNumbers. Only assign a response when the match is clear — genuinely independent responses that merely share a topic are NOT campaign variants. Return one entry per cluster, in cluster order.`,
    user: `Detected response clusters:\n\n${clusterText}\n\nUnclustered responses to scan for paraphrased variants:\n\n${unclusteredText || '(none)'}`,
    schema: CAMPAIGN_SCHEMA,
    effort: 'medium',
  })

  const campaigns: DetectedCampaign[] = []
  const variantIds = new Set<string>()

  topClusters.forEach((cluster, i) => {
    const characterized = result.campaigns.find(c => c.clusterNumber === i + 1)
    const rep = byId.get(cluster.representativeId)!

    // Resolve variant bracket numbers to real items, ignoring out-of-range or
    // already-claimed ids so counts can't double-book a response.
    const extraIds: string[] = []
    for (const num of characterized?.additionalVariantNumbers || []) {
      const item = unclustered[num - 1]
      if (item && !variantIds.has(item.id)) {
        variantIds.add(item.id)
        extraIds.push(item.id)
      }
    }

    const memberIds = [...cluster.memberIds, ...extraIds]
    campaigns.push({
      label: characterized?.label || `Template group ${i + 1}`,
      count: memberIds.length,
      stance: characterized?.stance || 'unclear',
      templateSummary: characterized?.templateSummary || '',
      personalAdditions: characterized?.personalAdditions || '',
      exact: cluster.exact && extraIds.length === 0,
      sampleQuote: rep.content.slice(0, 220),
      memberIds: memberIds.slice(0, MAX_STORED_MEMBER_IDS),
    })
  })

  // Clusters beyond the characterisation cap still count toward the totals.
  const uncharacterized = clusters.slice(MAX_CLUSTERS_TO_CHARACTERIZE)
  const templatedCount =
    campaigns.reduce((sum, c) => sum + c.count, 0) +
    uncharacterized.reduce((sum, c) => sum + c.memberIds.length, 0)

  return {
    totalAnalyzed: total,
    templatedCount,
    uniqueCount: Math.max(0, total - templatedCount),
    campaigns: campaigns.sort((a, b) => b.count - a.count),
  }
}

export async function runFullAnalysis(feedbackItems: FeedbackItem[]): Promise<FullAnalysisResult> {
  // One classification pass feeds sentiment, themes, geography and the
  // cross-tabs. Running them as separate passes would cost several times as
  // much and — worse — let the same response be counted differently in each.
  const [classification, materialAnalysis, campaignAnalysis] = await Promise.all([
    classifyCorpus(feedbackItems),
    classifyMaterialConsiderations(feedbackItems),
    analyzeCampaigns(feedbackItems),
  ])

  const sentiment = deriveSentiment(classification)
  const themes = deriveThemes(classification)
  const geographic = deriveGeographic(classification)

  // Pure computation over the assignments: exact, reproducible, no token cost.
  const crossRef = crossReference(
    classification.items.map(item => ({
      id: item.id,
      type: item.type,
      latitude: item.latitude,
      longitude: item.longitude,
      createdAt: new Date(item.createdAt),
    })),
    classification.taxonomy,
    classification.assignments
  )

  const [summary, headlineStats] = await Promise.all([
    generateSummary(
      feedbackItems,
      sentiment,
      themes,
      crossRef.highlights.slice(0, 8).map(describeHighlight)
    ),
    generateHeadlineStats(feedbackItems, sentiment, themes),
  ])

  return {
    sentiment,
    themes,
    summary,
    headlineStats,
    materialAnalysis,
    campaignAnalysis,
    geographic,
    crossReference: crossRef,
    coverage: classification.coverage,
    analyzedAt: new Date().toISOString(),
    feedbackCount: feedbackItems.length,
  }
}

const MATERIAL_ITEMS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'The bracket number of the response' },
          classification: { type: 'string', enum: ['material', 'non-material', 'mixed'] },
          materialCategories: { type: 'array', items: { type: 'string' } },
          nonMaterialCategories: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'classification', 'materialCategories', 'nonMaterialCategories'],
      },
    },
  },
  required: ['items'],
}

/**
 * Sort responses into material planning considerations and non-material
 * objections.
 *
 * Runs over every response rather than a sample: this output tells a planning
 * officer how much of the opposition a committee can lawfully weigh, and a
 * figure derived from a subset would misstate that. Category totals are tallied
 * from the per-response results, so they add up to the responses behind them.
 */
export async function classifyMaterialConsiderations(
  feedbackItems: FeedbackItem[]
): Promise<MaterialAnalysisResult> {
  const empty: MaterialAnalysisResult = {
    summary: { material: 0, nonMaterial: 0, mixed: 0 },
    categories: { material: [], nonMaterial: [] },
    items: [],
  }
  if (feedbackItems.length === 0) return empty

  const { items } = selectForAnalysis(feedbackItems)
  if (items.length === 0) return empty

  const system = `You are a UK planning expert. Classify each consultation response by whether it raises material planning considerations or non-material objections. Use the number in brackets as each response's id, and return exactly one result per response.

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
- "It's not fair" or "we don't want change" without material reason`

  const batches = chunk(items, CLASSIFY_BATCH_SIZE)

  const batchResults = await mapWithConcurrency(batches, CLASSIFY_CONCURRENCY, async batch => {
    const batchText = batch.map((item, i) => `[${i + 1}] ${item.content}`).join('\n\n')

    const result = await analysisCall<{ items: MaterialAnalysisResult['items'] }>({
      system,
      user: `Classify these responses:\n\n${batchText}`,
      schema: MATERIAL_ITEMS_SCHEMA,
      effort: 'medium',
      model: CLASSIFIER_MODEL,
      cacheSystem: true,
    })

    // Resolve by bracket number, not position — see classifyCorpus.
    const seen = new Set<string>()
    const resolved: MaterialAnalysisResult['items'] = []

    ;(result.items || []).forEach(entry => {
      const original = batch[parseInt(entry.id, 10) - 1]
      if (!original || seen.has(original.id)) return
      seen.add(original.id)

      resolved.push({
        id: original.id,
        classification: entry.classification,
        materialCategories: entry.materialCategories || [],
        nonMaterialCategories: entry.nonMaterialCategories || [],
      })
    })

    return resolved
  })

  const classified = batchResults.flat()
  const itemsById = new Map(items.map(item => [item.id, item]))

  const summary = { material: 0, nonMaterial: 0, mixed: 0 }
  classified.forEach(item => {
    if (item.classification === 'material') summary.material++
    else if (item.classification === 'non-material') summary.nonMaterial++
    else summary.mixed++
  })

  // Tally categories from the per-response results so every count is traceable.
  const tally = (pick: (item: MaterialAnalysisResult['items'][number]) => string[]) => {
    const counts = new Map<string, { count: number; examples: string[] }>()

    classified.forEach(item => {
      pick(item).forEach(name => {
        if (!counts.has(name)) counts.set(name, { count: 0, examples: [] })
        const entry = counts.get(name)!
        entry.count++

        if (entry.examples.length < 2) {
          const text = itemsById.get(item.id)?.content?.trim()
          if (text && text.length >= 40) {
            entry.examples.push(
              text.length > QUOTE_CHARS ? `${text.slice(0, QUOTE_CHARS).trimEnd()}…` : text
            )
          }
        }
      })
    })

    return Array.from(counts.entries())
      .map(([name, entry]) => ({ name, count: entry.count, examples: entry.examples }))
      .sort((a, b) => b.count - a.count)
  }

  return {
    summary,
    categories: {
      material: tally(item => item.materialCategories),
      nonMaterial: tally(item => item.nonMaterialCategories),
    },
    items: classified,
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
