import { describe, it, expect } from 'vitest'
import {
  twoProportionPValue,
  benjaminiHochberg,
  crossReference,
  describeHighlight,
  type CrossRefItem,
  type CrossRefAssignment,
} from './cross-reference'

describe('twoProportionPValue', () => {
  it('returns 1 for identical proportions', () => {
    expect(twoProportionPValue(50, 100, 50, 100)).toBeCloseTo(1, 5)
  })

  it('matches the textbook z-test value', () => {
    // 45/100 vs 30/100: pooled p = 0.375, z ≈ 2.191, two-sided p ≈ 0.0285
    const p = twoProportionPValue(45, 100, 30, 100)
    expect(p).toBeGreaterThan(0.026)
    expect(p).toBeLessThan(0.031)
  })

  it('approaches zero for extreme differences', () => {
    expect(twoProportionPValue(90, 100, 10, 100)).toBeLessThan(1e-6)
  })

  it('returns 1 when a test is not meaningful', () => {
    expect(twoProportionPValue(0, 0, 5, 10)).toBe(1)
    expect(twoProportionPValue(0, 10, 0, 10)).toBe(1) // pooled = 0
    expect(twoProportionPValue(10, 10, 10, 10)).toBe(1) // pooled = 1
  })

  it('is symmetric in group order', () => {
    expect(twoProportionPValue(45, 100, 30, 100)).toBeCloseTo(
      twoProportionPValue(30, 100, 45, 100),
      12
    )
  })
})

describe('benjaminiHochberg', () => {
  it('handles the empty case', () => {
    expect(benjaminiHochberg([], 0.05)).toEqual([])
  })

  it('rejects nothing when every p-value exceeds its threshold', () => {
    expect(benjaminiHochberg([0.5, 0.8, 0.9], 0.05)).toEqual([])
  })

  it('accepts everything up to the largest passing rank', () => {
    // thresholds at alpha 0.05, m=5: .01 .02 .03 .04 .05
    const passing = benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.2], 0.05)
    expect([...passing].sort()).toEqual([0, 1, 2, 3])
  })

  it('is a step-up procedure: a passing later rank rescues earlier misses', () => {
    // sorted: 0.001, 0.048, 0.049 vs thresholds 0.0167, 0.0333, 0.05.
    // 0.048 misses its own threshold but p(3) = 0.049 <= 0.05 passes,
    // so all three are discoveries.
    const passing = benjaminiHochberg([0.001, 0.049, 0.048], 0.05)
    expect([...passing].sort()).toEqual([0, 1, 2])
  })

  it('controls the family: one marginal p among many nulls is not a discovery', () => {
    const ps = [0.04, ...Array.from({ length: 19 }, () => 0.9)]
    expect(benjaminiHochberg(ps, 0.05)).toEqual([])
  })
})

/**
 * Fixture: 200 responses — 100 map pins (all in one ~1km grid cell) and 100
 * form responses (no location). "Flooding" is raised by 60 pins but only 5
 * forms; "Housing" is raised evenly (30 each). Timestamps interleave the two
 * sources across the consultation so the period split carries no signal.
 */
function buildFixture() {
  const base = Date.UTC(2026, 0, 1)
  const items: CrossRefItem[] = []
  const assignments: CrossRefAssignment[] = []

  for (let i = 0; i < 200; i++) {
    const isPin = i < 100
    items.push({
      id: `r${i}`,
      type: isPin ? 'pin' : 'form',
      latitude: isPin ? 51.5001 : null,
      longitude: isPin ? -0.1002 : null,
      // Even indices land in the early half, odd in the late half, so both
      // sources and both themes are balanced across the median split.
      createdAt: new Date(base + (i % 2) * 1_000_000_000 + i * 1000),
    })

    const themeIds: number[] = []
    if (isPin ? i < 60 : i < 105) themeIds.push(0) // Flooding: 60 pins, 5 forms
    if (isPin ? i >= 70 : i >= 170) themeIds.push(1) // Housing: 30 pins, 30 forms

    assignments.push({
      id: `r${i}`,
      sentiment: i % 3 === 0 ? 'negative' : i % 3 === 1 ? 'neutral' : 'positive',
      themeIds,
    })
  }

  return { items, assignments, taxonomy: [{ name: 'Flooding' }, { name: 'Housing' }] }
}

describe('crossReference', () => {
  it('returns the empty result for empty inputs', () => {
    const result = crossReference([], [], [])
    expect(result.highlights).toEqual([])
    expect(result.tested).toBe(0)
    expect(result.significant).toBe(0)
  })

  it('tallies exact counts into the descriptive tables', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)

    expect(result.tables.themeBySource['Flooding']).toEqual({
      'map pins': 60,
      'form responses': 5,
    })
    expect(result.tables.themeBySource['Housing']).toEqual({
      'map pins': 30,
      'form responses': 30,
    })

    const flooding = result.tables.themeBySentiment['Flooding']
    expect(flooding.positive + flooding.negative + flooding.neutral).toBe(65)

    const period = result.tables.themeByPeriod['Flooding']
    expect(period.early + period.late).toBe(65)
  })

  it('finds the real source concentration and reports exact figures', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)

    const finding = result.highlights.find(
      h => h.theme === 'Flooding' && h.dimension === 'source' && h.segment === 'map pins'
    )
    expect(finding).toBeDefined()
    expect(finding!.count).toBe(60)
    expect(finding!.segmentTotal).toBe(100)
    expect(finding!.segmentShare).toBeCloseTo(0.6, 10)
    expect(finding!.baselineShare).toBeCloseTo(0.05, 10)
    expect(finding!.lift).toBeCloseTo(12, 5)
    expect(finding!.pValue).toBeLessThan(0.001)
  })

  it('tests a complementary pair once, from the over-represented side', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)

    // The mirrored under-representation must not appear as a second finding.
    const mirror = result.highlights.find(
      h => h.dimension === 'source' && h.segment === 'form responses'
    )
    expect(mirror).toBeUndefined()

    // And the correction family only counts each pair once: two themes across
    // source, period, and a single area segment can never exceed six tests.
    expect(result.tested).toBeLessThanOrEqual(6)
  })

  it('reports no findings for a uniformly distributed theme', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)

    expect(result.highlights.filter(h => h.theme === 'Housing')).toEqual([])
  })

  it('reports no period findings when timing carries no signal', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)

    expect(result.highlights.filter(h => h.dimension === 'period')).toEqual([])
  })

  it('keeps significant === highlights.length', () => {
    const { items, assignments, taxonomy } = buildFixture()
    const result = crossReference(items, taxonomy, assignments)
    expect(result.significant).toBe(result.highlights.length)
  })
})

describe('describeHighlight', () => {
  it('describes an over-representation as a multiple', () => {
    const text = describeHighlight({
      theme: 'Flooding',
      dimension: 'source',
      segment: 'map pins',
      count: 60,
      segmentTotal: 100,
      segmentShare: 0.6,
      baselineShare: 0.05,
      lift: 12,
      pValue: 0.0001,
    })
    expect(text).toContain('60%')
    expect(text).toContain('60 of 100')
    expect(text).toContain('12.0× more common')
  })

  it('describes an exclusive theme without inventing a multiplier', () => {
    const text = describeHighlight({
      theme: 'Boundary planting',
      dimension: 'area',
      segment: '51.50, -0.10',
      count: 12,
      segmentTotal: 40,
      segmentShare: 0.3,
      baselineShare: 0,
      lift: 0,
      pValue: 0.0001,
    })
    expect(text).toContain('raised nowhere else')
    expect(text).not.toContain('×')
  })
})
