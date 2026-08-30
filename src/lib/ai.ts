import Anthropic from '@anthropic-ai/sdk'
import {
  crossReference,
  describeHighlight,
  type CrossReferenceResult,
  type CrossTab,
} from '@/lib/cross-reference'
import { clusterResponses } from './campaign-detection'
import { areaLabel, siteContext, type SiteContext } from './spatial'

// Lazy-load Anthropic client to avoid build-time errors
let anthropicClient: Anthropic | null = null

const MODEL = 'claude-opus-4-8'
// Per-item classification is high-volume and mechanical — it applies a fixed
// rubric rather than reasoning openly — so it runs on Haiku via the Batch API
// (half price, no request-timeout ceiling). The judgement calls that shape the
// report (taxonomy, campaign characterisation, summary) stay on Opus.
const CLASSIFIER_MODEL = 'claude-haiku-4-5'

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
 * matches the expected shape. Used for the synchronous Opus reasoning calls;
 * the per-response classification goes through the Batch API instead.
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

// Each item's text is truncated before it reaches a prompt. Themes and stance
// are almost always apparent in the opening lines, so this costs little.
const MAX_ITEM_CHARS = 1000

/**
 * Hard ceiling on how many responses a single analysis will classify. This is a
 * cost guard, not a sampling strategy — when it bites, the shortfall is
 * reported in `coverage` rather than hidden, and the subset taken is spread
 * evenly across the whole consultation rather than skewed to whoever responded
 * most recently.
 */
const MAX_ANALYSIS_ITEMS = 5000

/** Responses per classification request within the batch. */
const CLASSIFY_BATCH_SIZE = 100

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

function truncateContent(item: FeedbackItem): FeedbackItem {
  return item.content.length > MAX_ITEM_CHARS
    ? { ...item, content: item.content.slice(0, MAX_ITEM_CHARS) }
    : item
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

  const selected = evenlySpacedSample(chronological, MAX_ANALYSIS_ITEMS).map(truncateContent)

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

/**
 * A significance-tested geographic finding, pinned to a place and named in
 * plain language. The headline is model-written but grounded exclusively in
 * the counted figures and verbatim quotes from inside the area.
 */
export interface SpatialInsight {
  latitude: number
  longitude: number
  /** Plain-language place, e.g. "the north-east corner of the site". */
  areaLabel: string
  theme: string
  /** One report-ready sentence about what this area concentrates on. */
  headline: string
  /** A verbatim quote from a response inside the area (may be empty). */
  quote: string
  /** Responses in this area raising the theme. */
  count: number
  /** Classified responses in this area. */
  areaTotal: number
  share: number
  baselineShare: number
  lift: number
  pValue: number
  /** Stance across ALL classified responses in the area, not just the theme's. */
  dominantSentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  /** Ids of the responses behind `count` (capped). */
  responseIds: string[]
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
  /** Area findings named and characterised for the map. */
  spatialInsights?: SpatialInsight[]
  /** The theme taxonomy `assignments[].themeIds` index into. */
  taxonomy?: ThemeDefinition[]
  /**
   * Per-response classifications — the layer every aggregate above is counted
   * from, persisted so the workspace can filter and trace responses.
   */
  assignments?: ItemAssignment[]
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

// One merged schema per response: stance, themes and material considerations
// are read off the same response in one pass, so the corpus is classified once
// rather than twice.
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
          material: { type: 'string', enum: ['material', 'non-material', 'mixed'] },
          materialCategories: { type: 'array', items: { type: 'string' } },
          nonMaterialCategories: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'id',
          'sentiment',
          'confidence',
          'themes',
          'material',
          'materialCategories',
          'nonMaterialCategories',
        ],
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
  material: 'material' | 'non-material' | 'mixed'
  materialCategories: string[]
  nonMaterialCategories: string[]
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
 * The classifier's instructions: stance, theme assignment against the fixed
 * taxonomy, and the material-considerations rubric — one pass per response.
 */
function buildClassifierSystem(taxonomy: ThemeDefinition[]): string {
  const taxonomyText = taxonomy
    .map((theme, i) => `${i + 1}. ${theme.name} — ${theme.description}`)
    .join('\n')

  return `You are an expert at analysing public consultation responses on UK planning and development projects.

For each response, decide four things. Use the number in brackets as the response's id, and return exactly one result per response.

STANCE — positive if it supports or praises, negative if it opposes or raises concerns, neutral if it only asks a question or gives information. Judge the response's position on the proposal, not the tone of its language: a politely worded objection is negative.

THEMES — which of the numbered themes below the response raises. A response may raise several themes, or none. Assign a theme only when the response genuinely addresses it; do not stretch to give every response a theme.

THEMES:
${taxonomyText || '(no themes identified)'}

MATERIAL — whether the response raises material planning considerations, non-material objections, or both ("mixed"). List the specific categories raised under materialCategories / nonMaterialCategories.

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

interface CampaignCharacterisation {
  campaigns: Array<{
    clusterNumber: number
    label: string
    stance: DetectedCampaign['stance']
    templateSummary: string
    personalAdditions: string
    additionalVariantNumbers: number[]
  }>
}

// Caps for the characterisation prompt. Clustering itself runs over ALL items
// in code; only cluster samples and an unclustered subset reach the model.
const MAX_CLUSTERS_TO_CHARACTERIZE = 10
const MAX_UNCLUSTERED_FOR_VARIANT_SCAN = 120
const CAMPAIGN_SAMPLE_CHARS = 1200
const VARIANT_SCAN_CHARS = 300
const MAX_STORED_MEMBER_IDS = 100

const CAMPAIGN_SYSTEM = `You are an expert consultation analyst. Groups of near-identical responses have been detected in a public consultation — these are likely organised campaigns (template letters, copy-paste objections or support drives).

For each cluster: give it a short label, determine its stance toward the project, summarise what the shared template argues, and describe what (if anything) individual respondents added beyond the template.

Then check the UNCLUSTERED responses: if any are clearly a paraphrased or rewritten variant of one of the cluster templates (same campaign, reworded), list their bracket numbers under that campaign's additionalVariantNumbers. Only assign a response when the match is clear — genuinely independent responses that merely share a topic are NOT campaign variants. Return one entry per cluster, in cluster order.`

/**
 * State persisted between submitting an analysis batch and collecting its
 * results. Everything needed to resolve the batch output back to real
 * responses without re-running any model call.
 */
export interface PendingAnalysis {
  batchId: string
  taxonomy: ThemeDefinition[]
  coverage: AnalysisCoverage
  /** Item ids in the order they were sent, chunked per batch request. */
  chunks: string[][]
  campaign: {
    clusters: Array<{ representativeId: string; memberIds: string[]; exact: boolean }>
    /** Ids scanned for paraphrased variants, in bracket-number order. */
    unclusteredIds: string[]
  }
  startedAt: string
}

/**
 * Start a full analysis. Runs the taxonomy call (Opus) and the in-code
 * campaign clustering synchronously, then submits one Batch API job carrying
 * every classification chunk (Haiku) plus the campaign characterisation call
 * (Opus). Returns the state needed to finalize once the batch ends —
 * typically a few minutes later.
 */
export async function startFullAnalysis(feedbackItems: FeedbackItem[]): Promise<PendingAnalysis> {
  const { items, coverage } = selectForAnalysis(feedbackItems)
  if (items.length === 0) {
    throw new Error('No feedback to analyze')
  }

  const taxonomy = await discoverThemes(items)
  const system = buildClassifierSystem(taxonomy)
  const batches = chunk(items, CLASSIFY_BATCH_SIZE)

  const requests: Anthropic.Messages.BatchCreateParams['requests'] = batches.map(
    (batch, i) => ({
      custom_id: `classify-${i}`,
      params: {
        model: CLASSIFIER_MODEL,
        max_tokens: 16000,
        system,
        output_config: {
          format: { type: 'json_schema', schema: CLASSIFY_SCHEMA },
        },
        messages: [
          {
            role: 'user',
            content: `Classify these responses:\n\n${batch
              .map((item, n) => `[${n + 1}] (${item.type}) ${item.content}`)
              .join('\n\n')}`,
          },
        ],
      },
    })
  )

  // Campaign detection: clustering runs in code over the FULL corpus (zero
  // token cost); characterisation of the clusters rides along in the batch.
  const clusters = clusterResponses(
    feedbackItems.map(item => ({ id: item.id, content: item.content }))
  )
  const byId = new Map(feedbackItems.map(item => [item.id, item]))
  const clusteredIds = new Set(clusters.flatMap(c => c.memberIds))
  const topClusters = clusters.slice(0, MAX_CLUSTERS_TO_CHARACTERIZE)

  // Unclustered responses get scanned for paraphrased variants that shingle
  // similarity can't catch. Longest first — template rewrites are rarely short.
  const unclustered = feedbackItems
    .filter(item => !clusteredIds.has(item.id))
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, MAX_UNCLUSTERED_FOR_VARIANT_SCAN)

  if (topClusters.length > 0) {
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

    const unclusteredText = unclustered
      .map((item, i) => `[${i + 1}] ${item.content.slice(0, VARIANT_SCAN_CHARS)}`)
      .join('\n')

    requests.push({
      custom_id: 'campaigns',
      params: {
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: CAMPAIGN_SCHEMA },
        },
        system: CAMPAIGN_SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Detected response clusters:\n\n${clusterText}\n\nUnclustered responses to scan for paraphrased variants:\n\n${unclusteredText || '(none)'}`,
          },
        ],
      },
    })
  }

  const batch = await getAnthropic().messages.batches.create({ requests })

  return {
    batchId: batch.id,
    taxonomy,
    coverage,
    chunks: batches.map(b => b.map(item => item.id)),
    campaign: {
      clusters: clusters.map(c => ({
        representativeId: c.representativeId,
        memberIds: c.memberIds,
        exact: c.exact,
      })),
      unclusteredIds: unclustered.map(item => item.id),
    },
    startedAt: new Date().toISOString(),
  }
}

const SPATIAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          area: { type: 'integer', description: 'The AREA number this insight is for' },
          headline: {
            type: 'string',
            description:
              'One report-ready sentence (under 25 words) about what responses in this area concentrate on',
          },
          quoteNumber: {
            type: 'integer',
            description: 'The number of the single most representative quote provided for this area',
          },
        },
        required: ['area', 'headline', 'quoteNumber'],
      },
    },
  },
  required: ['insights'],
}

/** At most this many area findings are characterised for the map. */
const MAX_SPATIAL_INSIGHTS = 6
const MAX_SPATIAL_QUOTES = 4
const MAX_SPATIAL_RESPONSE_IDS = 200

/** Grid key matching the cross-reference area dimension (2dp ≈ 1km). */
function areaCellKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`
}

/**
 * Turn the significance-tested area findings into map-ready insights: name
 * each cell relative to the site boundary, gather the responses behind the
 * number, and have Opus write one grounded headline per area. The counts,
 * quotes, and statistics all come from code — the model only phrases them.
 */
async function generateSpatialInsights(
  crossRef: CrossReferenceResult,
  classification: CorpusClassification,
  boundaryGeojson: unknown | null
): Promise<SpatialInsight[] | undefined> {
  const areaFindings = crossRef.highlights
    .filter(h => h.dimension === 'area')
    .slice(0, MAX_SPATIAL_INSIGHTS)
  if (areaFindings.length === 0) return undefined

  const located = classification.items.filter(
    item => item.latitude != null && item.longitude != null
  )
  const site: SiteContext | null = siteContext(
    boundaryGeojson,
    located.map(item => ({ latitude: item.latitude!, longitude: item.longitude! }))
  )
  if (!site) return undefined

  const assignmentsById = new Map(classification.assignments.map(a => [a.id, a]))
  const themeIndexByName = new Map(classification.taxonomy.map((t, i) => [t.name, i]))

  const prepared = areaFindings.map((finding: CrossTab) => {
    const [latitude, longitude] = finding.segment.split(',').map(Number)
    const cellKey = finding.segment
    const themeId = themeIndexByName.get(finding.theme)

    const cellItems = located.filter(
      item => areaCellKey(item.latitude!, item.longitude!) === cellKey
    )

    const sentiments = { positive: 0, negative: 0, neutral: 0 }
    const memberIds: string[] = []
    const quotes: string[] = []

    cellItems.forEach(item => {
      const assignment = assignmentsById.get(item.id)
      if (!assignment) return
      sentiments[assignment.sentiment]++
      if (themeId != null && assignment.themeIds.includes(themeId)) {
        memberIds.push(item.id)
        const text = item.content.trim()
        if (quotes.length < MAX_SPATIAL_QUOTES && text.length >= 40) {
          quotes.push(text.length > 400 ? `${text.slice(0, 400).trimEnd()}…` : text)
        }
      }
    })

    const dominant = (Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0][0]) as
      | 'positive'
      | 'negative'
      | 'neutral'
    const mixed = sentiments.positive > 0 && sentiments.negative > 0

    return {
      finding,
      latitude,
      longitude,
      label: areaLabel({ latitude, longitude }, site),
      sentiments,
      dominantSentiment: mixed ? ('mixed' as const) : dominant,
      memberIds,
      quotes,
    }
  })

  // One small Opus call phrases every area at once. The deterministic
  // fallback below means a failed call degrades wording, never data.
  let phrased: { insights: Array<{ area: number; headline: string; quoteNumber: number }> } | null =
    null
  try {
    const areaText = prepared
      .map((area, i) => {
        const f = area.finding
        return [
          `AREA ${i + 1} — ${area.label}`,
          `"${f.theme}" is raised by ${f.count} of the ${f.segmentTotal} responses here (${Math.round(f.segmentShare * 100)}%), against ${Math.round(f.baselineShare * 100)}% elsewhere.`,
          `Stance in this area: ${area.sentiments.positive} positive / ${area.sentiments.negative} negative / ${area.sentiments.neutral} neutral.`,
          `Quotes from responses here that raise the theme:`,
          ...(area.quotes.length > 0
            ? area.quotes.map((q, n) => `[${n + 1}] ${q}`)
            : ['(none long enough to quote)']),
        ].join('\n')
      })
      .join('\n\n')

    phrased = await analysisCall({
      system: `You are an expert consultation analyst. For each AREA below, write one report-ready headline sentence: what the responses in that area concentrate on and what they are asking for, grounded ONLY in the figures and quotes provided. Under 25 words, plain English, no coordinates, no invented numbers — the exact statistics are displayed alongside your sentence. Also pick the single most representative quote by its number (use 0 if no quotes were provided). Return one entry per area, in area order.`,
      user: `Characterise these areas:\n\n${areaText}`,
      schema: SPATIAL_SCHEMA,
      effort: 'low',
    })
  } catch (error) {
    console.warn('generateSpatialInsights: characterisation call failed', error)
  }

  return prepared.map((area, i) => {
    const entry = phrased?.insights.find(insight => insight.area === i + 1)
    const quote =
      entry && entry.quoteNumber >= 1 && entry.quoteNumber <= area.quotes.length
        ? area.quotes[entry.quoteNumber - 1]
        : area.quotes[0] || ''

    return {
      latitude: area.latitude,
      longitude: area.longitude,
      areaLabel: area.label,
      theme: area.finding.theme,
      headline:
        entry?.headline ||
        `"${area.finding.theme}" is raised in ${Math.round(area.finding.segmentShare * 100)}% of responses around ${area.label}, against ${Math.round(area.finding.baselineShare * 100)}% elsewhere.`,
      quote: quote.length > QUOTE_CHARS * 2 ? `${quote.slice(0, QUOTE_CHARS * 2).trimEnd()}…` : quote,
      count: area.finding.count,
      areaTotal: area.finding.segmentTotal,
      share: area.finding.segmentShare,
      baselineShare: area.finding.baselineShare,
      lift: area.finding.lift,
      pValue: area.finding.pValue,
      dominantSentiment: area.dominantSentiment,
      responseIds: area.memberIds.slice(0, MAX_SPATIAL_RESPONSE_IDS),
    }
  })
}

/** Whether a submitted analysis batch has finished processing. */
export async function isAnalysisBatchReady(batchId: string): Promise<boolean> {
  const batch = await getAnthropic().messages.batches.retrieve(batchId)
  return batch.processing_status === 'ended'
}

/**
 * Collect a finished batch and assemble the full analysis. All counting and
 * statistics run here in code; the only model calls are the summary and
 * headline stats (Opus), written from the counted figures.
 *
 * A failed or dropped chunk no longer kills the run — its responses are simply
 * missing from the counts, and `coverage` reports the shortfall.
 */
export async function finalizeFullAnalysis(
  pending: PendingAnalysis,
  feedbackItems: FeedbackItem[],
  options?: {
    /** The project's boundary layer, used to name spatial findings. */
    boundaryGeojson?: unknown | null
  }
): Promise<FullAnalysisResult> {
  const byId = new Map(feedbackItems.map(item => [item.id, truncateContent(item)]))

  // The classified items, in the order they were sent. Items deleted since
  // submission drop out here and from every count downstream.
  const items = pending.chunks
    .flat()
    .map(id => byId.get(id))
    .filter((item): item is FeedbackItem => !!item)

  const assignments: ItemAssignment[] = []
  let campaignRaw: CampaignCharacterisation | null = null
  const seen = new Set<string>()

  const results = await getAnthropic().messages.batches.results(pending.batchId)
  for await (const entry of results) {
    if (entry.result.type !== 'succeeded') {
      console.warn(`finalizeFullAnalysis: request ${entry.custom_id} ${entry.result.type}`)
      continue
    }
    const textBlock = entry.result.message.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (!textBlock) continue

    if (entry.custom_id === 'campaigns') {
      try {
        campaignRaw = JSON.parse(textBlock.text) as CampaignCharacterisation
      } catch {
        console.warn('finalizeFullAnalysis: campaign characterisation unparseable')
      }
      continue
    }

    const match = entry.custom_id.match(/^classify-(\d+)$/)
    if (!match) continue
    const chunkIds = pending.chunks[Number(match[1])]
    if (!chunkIds) continue

    let parsed: {
      items: Array<{
        id: string
        sentiment: 'positive' | 'negative' | 'neutral'
        confidence: number
        themes: number[]
        material: 'material' | 'non-material' | 'mixed'
        materialCategories: string[]
        nonMaterialCategories: string[]
      }>
    }
    try {
      parsed = JSON.parse(textBlock.text)
    } catch {
      console.warn(`finalizeFullAnalysis: chunk ${entry.custom_id} unparseable`)
      continue
    }

    // Resolve by bracket number rather than position: the model may reorder,
    // drop, or repeat entries, and a positional read would then attribute one
    // resident's view to another.
    for (const result of parsed.items || []) {
      const originalId = chunkIds[parseInt(result.id, 10) - 1]
      if (!originalId || seen.has(originalId) || !byId.has(originalId)) continue
      seen.add(originalId)

      assignments.push({
        id: originalId,
        sentiment: result.sentiment,
        confidence: result.confidence,
        themeIds: (result.themes || [])
          // Model-supplied indices are 1-based and can be out of range.
          .map(n => n - 1)
          .filter(index => index >= 0 && index < pending.taxonomy.length),
        material: result.material,
        materialCategories: result.materialCategories || [],
        nonMaterialCategories: result.nonMaterialCategories || [],
      })
    }
  }

  // Anything the model failed to return is missing from the counts, so the
  // coverage figure reflects what was actually classified, not what was sent.
  const coverage: AnalysisCoverage = {
    ...pending.coverage,
    analyzed: assignments.length,
    complete: pending.coverage.complete && assignments.length === items.length,
  }
  if (!coverage.complete && !coverage.note) {
    coverage.note = `Classified ${assignments.length} of ${coverage.total} responses.`
  }

  const classification: CorpusClassification = {
    taxonomy: pending.taxonomy,
    assignments,
    items,
    coverage,
  }

  const sentiment = deriveSentiment(classification)
  const themes = deriveThemes(classification)
  const geographic = deriveGeographic(classification)
  const materialAnalysis = deriveMaterial(classification)
  const campaignAnalysis = resolveCampaigns(pending.campaign, campaignRaw, feedbackItems)

  // Pure computation over the assignments: exact, reproducible, no token cost.
  const crossRef = crossReference(
    items.map(item => ({
      id: item.id,
      type: item.type,
      latitude: item.latitude,
      longitude: item.longitude,
      createdAt: new Date(item.createdAt),
    })),
    pending.taxonomy,
    assignments
  )

  const [summary, spatialInsights] = await Promise.all([
    generateSummary(
      feedbackItems,
      sentiment,
      themes,
      crossRef.highlights.slice(0, 8).map(describeHighlight)
    ),
    generateSpatialInsights(crossRef, classification, options?.boundaryGeojson ?? null),
  ])

  return {
    sentiment,
    themes,
    summary,
    materialAnalysis,
    campaignAnalysis,
    geographic,
    crossReference: crossRef,
    spatialInsights,
    taxonomy: pending.taxonomy,
    assignments,
    coverage,
    analyzedAt: new Date().toISOString(),
    feedbackCount: feedbackItems.length,
  }
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
 * Aggregate material considerations from the per-response assignments. This
 * tells a planning officer how much of the opposition a committee can lawfully
 * weigh, so it runs over every classified response, and every category total
 * adds up to the responses behind it.
 */
export function deriveMaterial(classification: CorpusClassification): MaterialAnalysisResult {
  const { assignments, items } = classification
  const itemsById = new Map(items.map(item => [item.id, item]))

  const summary = { material: 0, nonMaterial: 0, mixed: 0 }
  assignments.forEach(a => {
    if (a.material === 'material') summary.material++
    else if (a.material === 'non-material') summary.nonMaterial++
    else summary.mixed++
  })

  const tally = (pick: (a: ItemAssignment) => string[]) => {
    const counts = new Map<string, { count: number; examples: string[] }>()

    assignments.forEach(assignment => {
      pick(assignment).forEach(name => {
        if (!counts.has(name)) counts.set(name, { count: 0, examples: [] })
        const entry = counts.get(name)!
        entry.count++

        if (entry.examples.length < 2) {
          const text = itemsById.get(assignment.id)?.content?.trim()
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
      material: tally(a => a.materialCategories),
      nonMaterial: tally(a => a.nonMaterialCategories),
    },
    items: assignments.map(a => ({
      id: a.id,
      classification: a.material,
      materialCategories: a.materialCategories,
      nonMaterialCategories: a.nonMaterialCategories,
    })),
  }
}

/**
 * Assemble the campaign result from the in-code clustering (done at submit
 * time) and the model's characterisation of each cluster (from the batch).
 */
function resolveCampaigns(
  campaignState: PendingAnalysis['campaign'],
  characterisation: CampaignCharacterisation | null,
  feedbackItems: FeedbackItem[]
): CampaignAnalysisResult {
  const total = feedbackItems.length
  const { clusters, unclusteredIds } = campaignState

  const empty: CampaignAnalysisResult = {
    totalAnalyzed: total,
    templatedCount: 0,
    uniqueCount: total,
    campaigns: [],
  }
  if (clusters.length === 0) return empty

  const byId = new Map(feedbackItems.map(item => [item.id, item]))
  const topClusters = clusters.slice(0, MAX_CLUSTERS_TO_CHARACTERIZE)

  const campaigns: DetectedCampaign[] = []
  const variantIds = new Set<string>()

  topClusters.forEach((cluster, i) => {
    const characterized = characterisation?.campaigns.find(c => c.clusterNumber === i + 1)
    const rep = byId.get(cluster.representativeId)

    // Resolve variant bracket numbers to real items, ignoring out-of-range or
    // already-claimed ids so counts can't double-book a response.
    const extraIds: string[] = []
    for (const num of characterized?.additionalVariantNumbers || []) {
      const id = unclusteredIds[num - 1]
      if (id && !variantIds.has(id) && byId.has(id)) {
        variantIds.add(id)
        extraIds.push(id)
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
      sampleQuote: rep ? rep.content.slice(0, 220) : '',
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
  const sampleItems = feedbackItems.slice(0, 20)
  const feedbackSample = sampleItems
    .map((item, index) => `[#${index + 1}] ${item.content.slice(0, MAX_ITEM_CHARS)}`)
    .join('\n---\n')

  const summary = await analysisCall<SummaryResult>({
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
${feedbackSample}

When a specific response directly illustrates a point, cite it inline as [#n] using the bracket numbers from the sample above. Cite sparingly — at most one citation per sentence, and only numbers that appear in the sample.`,
    schema: SUMMARY_SCHEMA,
    effort: 'medium',
  })

  return resolveCitations(summary, sampleItems)
}

/**
 * Replace the model's [#n] citation markers with [ref:<responseId>] tokens.
 * Every reference is validated against the sample that was actually shown to
 * the model — out-of-range or hallucinated numbers are stripped, so the UI
 * only ever links to a response that exists and informed the sentence.
 */
function resolveCitations(summary: SummaryResult, sampleItems: FeedbackItem[]): SummaryResult {
  const resolve = (text: string) =>
    text
      .replace(/\s*\[#(\d+)\]/g, (_match, n: string) => {
        const item = sampleItems[parseInt(n, 10) - 1]
        return item ? ` [ref:${item.id}]` : ''
      })
      .replace(/ {2,}/g, ' ')
      .trim()

  return {
    executive: resolve(summary.executive),
    keyFindings: (summary.keyFindings || []).map(resolve),
    recommendations: (summary.recommendations || []).map(resolve),
    concernAreas: (summary.concernAreas || []).map(resolve),
    supportAreas: (summary.supportAreas || []).map(resolve),
  }
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
