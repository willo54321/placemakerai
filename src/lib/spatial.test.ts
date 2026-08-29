import { describe, it, expect } from 'vitest'
import {
  distanceKm,
  bearingDegrees,
  compassName,
  extractPositions,
  siteContext,
  areaLabel,
} from './spatial'

const SITE = { latitude: 51.5, longitude: -0.1 }

describe('distanceKm', () => {
  it('measures one degree of latitude as ~111 km', () => {
    const d = distanceKm(SITE, { latitude: 52.5, longitude: -0.1 })
    expect(d).toBeGreaterThan(110)
    expect(d).toBeLessThan(112)
  })

  it('is zero for the same point', () => {
    expect(distanceKm(SITE, SITE)).toBe(0)
  })
})

describe('bearingDegrees / compassName', () => {
  it('names the cardinal directions', () => {
    expect(compassName(bearingDegrees(SITE, { latitude: 51.6, longitude: -0.1 }))).toBe('north')
    expect(compassName(bearingDegrees(SITE, { latitude: 51.5, longitude: 0.0 }))).toBe('east')
    expect(compassName(bearingDegrees(SITE, { latitude: 51.4, longitude: -0.1 }))).toBe('south')
    expect(compassName(bearingDegrees(SITE, { latitude: 51.5, longitude: -0.2 }))).toBe('west')
  })

  it('names diagonals', () => {
    // At 51.5°N, one degree of longitude spans ~0.62 degrees of latitude, so
    // match the on-the-ground aspect ratio rather than raw degrees.
    expect(
      compassName(bearingDegrees(SITE, { latitude: 51.6, longitude: 0.061 }))
    ).toBe('north-east')
  })

  it('wraps around north', () => {
    expect(compassName(350)).toBe('north')
    expect(compassName(10)).toBe('north')
  })
})

describe('extractPositions', () => {
  it('walks a FeatureCollection down to its positions', () => {
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-0.11, 51.49],
                [-0.09, 51.49],
                [-0.09, 51.51],
                [-0.11, 51.51],
                [-0.11, 51.49],
              ],
            ],
          },
        },
      ],
    }
    const points = extractPositions(geojson)
    expect(points).toHaveLength(5)
    // GeoJSON is [lng, lat] — verify the axes weren't swapped
    expect(points[0]).toEqual({ latitude: 51.49, longitude: -0.11 })
  })

  it('ignores junk and empty input', () => {
    expect(extractPositions(null)).toEqual([])
    expect(extractPositions({ type: 'FeatureCollection', features: [] })).toEqual([])
  })
})

describe('siteContext', () => {
  it('prefers the boundary, falls back to points', () => {
    const boundary = {
      type: 'Polygon',
      coordinates: [
        [
          [-0.11, 51.49],
          [-0.09, 51.49],
          [-0.09, 51.51],
          [-0.11, 51.51],
        ],
      ],
    }
    const fromBoundary = siteContext(boundary, [])
    expect(fromBoundary).not.toBeNull()
    expect(fromBoundary!.centroid.latitude).toBeCloseTo(51.5, 5)
    expect(fromBoundary!.centroid.longitude).toBeCloseTo(-0.1, 5)

    const fromPoints = siteContext(null, [
      { latitude: 51.49, longitude: -0.1 },
      { latitude: 51.51, longitude: -0.1 },
    ])
    expect(fromPoints!.centroid.latitude).toBeCloseTo(51.5, 5)

    expect(siteContext(null, [])).toBeNull()
  })

  it('never collapses the radius to zero', () => {
    const context = siteContext(null, [SITE, SITE])
    expect(context!.radiusKm).toBeGreaterThanOrEqual(0.15)
  })
})

describe('areaLabel', () => {
  const site = { centroid: SITE, radiusKm: 1 }

  it('names the centre', () => {
    expect(areaLabel({ latitude: 51.501, longitude: -0.1 }, site)).toBe('the centre of the site')
  })

  it('names a diagonal as a corner and a cardinal as an edge', () => {
    // ~1 km NE (adjusted for longitude compression at this latitude)
    expect(areaLabel({ latitude: 51.5063, longitude: -0.0899 }, site)).toBe(
      'the north-east corner of the site'
    )
    // ~1 km N
    expect(areaLabel({ latitude: 51.509, longitude: -0.1 }, site)).toBe(
      'the northern edge of the site'
    )
  })

  it('names nearby surroundings and far-away places', () => {
    // ~2 km south
    expect(areaLabel({ latitude: 51.482, longitude: -0.1 }, site)).toBe('just south of the site')
    // ~22 km west
    expect(areaLabel({ latitude: 51.5, longitude: -0.42 }, site)).toMatch(
      /^west of the site \(~\d+(\.\d)? km away\)$/
    )
  })
})
