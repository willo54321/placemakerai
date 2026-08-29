/**
 * Cross-referencing for consultation analysis.
 *
 * Once every response has been classified against a stable theme list, the
 * interesting question stops being "what are the themes" and becomes "who is
 * raising which theme, and where". That is a contingency-table problem, not a
 * language problem, so it is computed here in code rather than asked of the
 * model: the counts are exact, the results are reproducible run to run, and it
 * costs nothing per analysis.
 *
 * Every reported pattern is significance-tested. A theme that looks concentrated
 * in one ward is usually just a small sample, and reporting that to a planning
 * committee as a finding would be worse than reporting nothing.
 */

export type Sentiment = 'positive' | 'negative' | 'neutral'

export interface CrossRefItem {
  id: string
  type: 'pin' | 'form' | 'enquiry'
  latitude?: number | null
  longitude?: number | null
  createdAt: Date
}

export interface CrossRefAssignment {
  id: string
  sentiment: Sentiment
  /** Indices into the taxonomy array. */
  themeIds: number[]
}

/** One theme × segment pair that survived significance testing. */
export interface CrossTab {
  theme: string
  dimension: 'source' | 'sentiment' | 'area' | 'period'
  /** Human-readable segment name, e.g. "map pins" or "51.502, -0.128". */
  segment: string
  /** Responses in this segment that raise this theme. */
  count: number
  /** Total responses in this segment. */
  segmentTotal: number
  /** Share of this segment raising the theme. */
  segmentShare: number
  /** Share of everything outside this segment raising the theme. */
  baselineShare: number
  /** segmentShare / baselineShare. >1 means over-represented here. */
  lift: number
  pValue: number
}

export interface AreaBreakdown {
  /** Rounded centroid, used as the segment key. */
  latitude: number
  longitude: number
  total: number
  /** Theme name -> count within this area. */
  counts: Record<string, number>
  dominantSentiment: Sentiment | 'mixed'
}

export interface CrossReferenceResult {
  /**
   * Statistically notable theme × segment pairs, strongest lift first. These
   * are the sentences worth putting in a report.
   */
  highlights: CrossTab[]
  tables: {
    themeBySource: Record<string, Record<string, number>>
    themeBySentiment: Record<string, { positive: number; negative: number; neutral: number }>
    themeByArea: AreaBreakdown[]
    /** Split at the median response time — a late surge suggests a campaign. */
    themeByPeriod: Record<string, { early: number; late: number }>
  }
  /** Pairs tested, and how many survived. Useful for explaining "no findings". */
  tested: number
  significant: number
}

export interface CrossReferenceOptions {
  /** False-discovery rate for the Benjamini-Hochberg correction. */
  alpha?: number
  /** Segments smaller than this are never tested. */
  minSegmentSize?: number
  /** A pattern needs at least this many responses behind it to be reported. */
  minCount?: number
  /** Decimal places for the geographic grid. 2dp is roughly 1km. */
  areaPrecision?: number
}

const DEFAULTS: Required<CrossReferenceOptions> = {
  alpha: 0.05,
  minSegmentSize: 20,
  minCount: 5,
  areaPrecision: 2,
}

const SOURCE_LABELS: Record<CrossRefItem['type'], string> = {
  pin: 'map pins',
  form: 'form responses',
  enquiry: 'enquiries',
}

/**
 * Abramowitz & Stegun 7.1.26 approximation of the error function.
 * Accurate to ~1.5e-7, which is far beyond what a p-value threshold needs.
 */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)

  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-ax * ax)

  return sign * y
}

/** Two-sided p-value for a standard normal deviate. */
function twoSidedP(z: number): number {
  return 1 - erf(Math.abs(z) / Math.SQRT2)
}

/**
 * Two-proportion z-test with a pooled estimate: is the rate in the segment
 * different from the rate everywhere else? Returns 1 when the test is not
 * meaningful (empty group, zero variance) so the pair is simply never reported.
 */
export function twoProportionPValue(
  successesA: number,
  totalA: number,
  successesB: number,
  totalB: number
): number {
  if (totalA <= 0 || totalB <= 0) return 1

  const pA = successesA / totalA
  const pB = successesB / totalB
  const pooled = (successesA + successesB) / (totalA + totalB)

  if (pooled <= 0 || pooled >= 1) return 1

  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB))
  if (se === 0) return 1

  return twoSidedP((pA - pB) / se)
}

/**
 * Benjamini-Hochberg. We test every theme against every segment, so without a
 * correction one pair in twenty comes back "significant" by chance alone — and
 * with ten themes across a dozen segments that is several fabricated findings
 * per report. BH controls the false-discovery rate while keeping more power
 * than Bonferroni, which matters because real consultation effects are often
 * modest.
 *
 * Returns the indices of the candidates that pass.
 */
export function benjaminiHochberg(pValues: number[], alpha: number): number[] {
  const m = pValues.length
  if (m === 0) return []

  const ordered = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p)

  // Largest k where p_(k) <= (k/m) * alpha; everything up to k is a discovery.
  let cutoff = -1
  ordered.forEach((entry, i) => {
    if (entry.p <= ((i + 1) / m) * alpha) cutoff = i
  })

  if (cutoff < 0) return []
  return ordered.slice(0, cutoff + 1).map(entry => entry.index)
}

/** Empty result, so callers never branch on undefined. */
function emptyResult(): CrossReferenceResult {
  return {
    highlights: [],
    tables: { themeBySource: {}, themeBySentiment: {}, themeByArea: [], themeByPeriod: {} },
    tested: 0,
    significant: 0,
  }
}

interface Candidate {
  tab: Omit<CrossTab, 'pValue'>
  pValue: number
}

/** How far a pattern departs from the baseline, for ranking. */
function strength(tab: CrossTab): number {
  if (tab.baselineShare === 0) return Number.MAX_SAFE_INTEGER
  if (tab.lift <= 0) return 0
  return Math.abs(Math.log(tab.lift))
}

/**
 * Build the contingency tables and test every theme × segment pair.
 *
 * `assignments` need not cover every item — items with no assignment are
 * excluded from both the segment and the baseline, so partial coverage
 * produces conservative rather than misleading numbers.
 */
export function crossReference(
  items: CrossRefItem[],
  taxonomy: Array<{ name: string }>,
  assignments: CrossRefAssignment[],
  options: CrossReferenceOptions = {}
): CrossReferenceResult {
  const opts = { ...DEFAULTS, ...options }

  if (items.length === 0 || taxonomy.length === 0 || assignments.length === 0) {
    return emptyResult()
  }

  const itemsById = new Map(items.map(item => [item.id, item]))
  const classified = assignments.filter(a => itemsById.has(a.id))
  if (classified.length === 0) return emptyResult()

  const themeNames = taxonomy.map(t => t.name)
  const themeIndices = themeNames.map((_, i) => i)

  // Which classified items raise each theme — the numerator for every test.
  const idsByTheme = new Map<number, Set<string>>(themeIndices.map(i => [i, new Set<string>()]))
  classified.forEach(assignment => {
    assignment.themeIds.forEach(themeId => {
      idsByTheme.get(themeId)?.add(assignment.id)
    })
  })

  const sentimentById = new Map(classified.map(a => [a.id, a.sentiment]))

  // --- segments -----------------------------------------------------------
  // A segment is a named subset of the classified corpus. Every dimension
  // reduces to the same shape, so one test loop covers all of them.
  const segments: Array<{
    dimension: CrossTab['dimension']
    label: string
    ids: Set<string>
  }> = []

  // Source
  const bySource = new Map<CrossRefItem['type'], Set<string>>()
  classified.forEach(a => {
    const item = itemsById.get(a.id)!
    if (!bySource.has(item.type)) bySource.set(item.type, new Set())
    bySource.get(item.type)!.add(a.id)
  })
  bySource.forEach((ids, type) =>
    segments.push({ dimension: 'source', label: SOURCE_LABELS[type], ids })
  )

  // Sentiment is deliberately NOT tested as a segment. Stance and theme are
  // read off the same response in the same pass, so "objections mention traffic"
  // is close to circular — it measures the classifier, not the consultation.
  // Testing it anyway would also enlarge the correction family and cost power
  // on the dimensions that do carry information. The theme × sentiment split is
  // still reported descriptively in `tables.themeBySentiment`.

  // Geography, on a rounded grid. Only items that actually carry coordinates.
  const byArea = new Map<string, Set<string>>()
  classified.forEach(a => {
    const item = itemsById.get(a.id)!
    if (item.latitude == null || item.longitude == null) return
    const key = `${item.latitude.toFixed(opts.areaPrecision)},${item.longitude.toFixed(opts.areaPrecision)}`
    if (!byArea.has(key)) byArea.set(key, new Set())
    byArea.get(key)!.add(a.id)
  })
  byArea.forEach((ids, key) => segments.push({ dimension: 'area', label: key, ids }))

  // Time, split at the median so the two halves are balanced by construction.
  const sortedTimes = classified
    .map(a => itemsById.get(a.id)!.createdAt.getTime())
    .sort((a, b) => a - b)
  const median = sortedTimes[Math.floor(sortedTimes.length / 2)]
  const earlyIds = new Set<string>()
  const lateIds = new Set<string>()
  classified.forEach(a => {
    const at = itemsById.get(a.id)!.createdAt.getTime()
    if (at < median) earlyIds.add(a.id)
    else lateIds.add(a.id)
  })
  if (earlyIds.size > 0 && lateIds.size > 0) {
    segments.push({ dimension: 'period', label: 'earlier responses', ids: earlyIds })
    segments.push({ dimension: 'period', label: 'later responses', ids: lateIds })
  }

  // --- tests --------------------------------------------------------------
  const totalClassified = classified.length
  const candidates: Candidate[] = []

  themeIndices.forEach(themeId => {
    const themeIds = idsByTheme.get(themeId)!
    const themeTotal = themeIds.size
    if (themeTotal === 0) return

    segments.forEach(segment => {
      const segmentTotal = segment.ids.size
      if (segmentTotal < opts.minSegmentSize) return

      let inSegment = 0
      segment.ids.forEach(id => {
        if (themeIds.has(id)) inSegment++
      })
      if (inSegment < opts.minCount) return

      const outsideTotal = totalClassified - segmentTotal
      const outsideCount = themeTotal - inSegment
      if (outsideTotal <= 0) return

      const segmentShare = inSegment / segmentTotal
      const baselineShare = outsideCount / outsideTotal
      // A theme raised by nobody outside the segment has no meaningful ratio.
      // Lift is left at 0 and `baselineShare === 0` is the signal to describe it
      // as exclusive rather than as a multiple — quoting a made-up multiplier in
      // a committee report would be worse than saying "only here".
      const lift = baselineShare > 0 ? segmentShare / baselineShare : 0

      candidates.push({
        tab: {
          theme: themeNames[themeId],
          dimension: segment.dimension,
          segment: segment.label,
          count: inSegment,
          segmentTotal,
          segmentShare,
          baselineShare,
          lift,
        },
        pValue: twoProportionPValue(inSegment, segmentTotal, outsideCount, outsideTotal),
      })
    })
  })

  const passing = new Set(
    benjaminiHochberg(
      candidates.map(c => c.pValue),
      opts.alpha
    )
  )

  const highlights: CrossTab[] = candidates
    .filter((_, i) => passing.has(i))
    .map(c => ({ ...c.tab, pValue: c.pValue }))
    // Strongest departure from the baseline first, in either direction. A theme
    // confined entirely to one segment ranks above any finite multiple.
    .sort((a, b) => strength(b) - strength(a))

  // --- descriptive tables -------------------------------------------------
  const themeBySource: Record<string, Record<string, number>> = {}
  const themeBySentiment: Record<string, { positive: number; negative: number; neutral: number }> = {}

  themeIndices.forEach(themeId => {
    const name = themeNames[themeId]
    const themeIds = idsByTheme.get(themeId)!

    const sourceCounts: Record<string, number> = {}
    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 }

    themeIds.forEach(id => {
      const item = itemsById.get(id)
      if (item) {
        const label = SOURCE_LABELS[item.type]
        sourceCounts[label] = (sourceCounts[label] || 0) + 1
      }
      const sentiment = sentimentById.get(id)
      if (sentiment) sentimentCounts[sentiment]++
    })

    themeBySource[name] = sourceCounts
    themeBySentiment[name] = sentimentCounts
  })

  const themeByArea: AreaBreakdown[] = Array.from(byArea.entries())
    .map(([key, ids]) => {
      const [latitude, longitude] = key.split(',').map(Number)
      const counts: Record<string, number> = {}
      const sentiments = { positive: 0, negative: 0, neutral: 0 }

      ids.forEach(id => {
        themeIndices.forEach(themeId => {
          if (idsByTheme.get(themeId)!.has(id)) {
            const name = themeNames[themeId]
            counts[name] = (counts[name] || 0) + 1
          }
        })
        const sentiment = sentimentById.get(id)
        if (sentiment) sentiments[sentiment]++
      })

      const dominant = (Object.entries(sentiments).sort((a, b) => b[1] - a[1])[0][0]) as Sentiment
      const mixed = sentiments.positive > 0 && sentiments.negative > 0

      return {
        latitude,
        longitude,
        total: ids.size,
        counts,
        dominantSentiment: mixed ? ('mixed' as const) : dominant,
      }
    })
    .sort((a, b) => b.total - a.total)

  const themeByPeriod: Record<string, { early: number; late: number }> = {}
  themeIndices.forEach(themeId => {
    const themeIds = idsByTheme.get(themeId)!
    let early = 0
    let late = 0
    themeIds.forEach(id => {
      if (earlyIds.has(id)) early++
      else if (lateIds.has(id)) late++
    })
    themeByPeriod[themeNames[themeId]] = { early, late }
  })

  return {
    highlights,
    tables: { themeBySource, themeBySentiment, themeByArea, themeByPeriod },
    tested: candidates.length,
    significant: highlights.length,
  }
}

/**
 * Render a highlight as a sentence a planning officer could paste into a
 * report. Kept next to the maths so the wording and the numbers cannot drift.
 */
export function describeHighlight(tab: CrossTab): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const direction = tab.lift >= 1 ? 'more' : 'less'
  const where =
    tab.dimension === 'area'
      ? `around ${tab.segment}`
      : tab.dimension === 'period'
        ? `among ${tab.segment}`
        : `in ${tab.segment}`

  const head =
    `"${tab.theme}" appears in ${pct(tab.segmentShare)} of responses ${where} ` +
    `(${tab.count} of ${tab.segmentTotal})`

  if (tab.baselineShare === 0) {
    return `${head}, and is raised nowhere else.`
  }

  const multiple = tab.lift >= 1 ? tab.lift : 1 / tab.lift
  return `${head}, against ${pct(tab.baselineShare)} elsewhere — ${multiple.toFixed(1)}× ${direction} common.`
}
