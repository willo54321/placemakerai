import { describe, it, expect } from 'vitest'
import { autoLayerStyle, categoryProperty, featureColor, isBoundaryLayer } from './layer-style'

const square = (props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
})
const fc = (...features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features })

describe('isBoundaryLayer', () => {
  it('spots red-line boundaries by name or attribute', () => {
    expect(isBoundaryLayer('SEF_OrderLimits', fc(square()))).toBe(true)
    expect(isBoundaryLayer('parcels', fc(square({ LimitDescr: '2025 Non Material Change Red Line Boundary' })))).toBe(true)
    expect(isBoundaryLayer('parcels', fc(square({ use: 'Housing' })))).toBe(false)
  })
})

describe('categoryProperty', () => {
  it('prefers a land-use style field with repeated values', () => {
    const layer = fc(
      square({ id: 'a', LAND_USE: 'Housing', owner: 'X' }),
      square({ id: 'b', LAND_USE: 'Open space', owner: 'Y' }),
      square({ id: 'c', LAND_USE: 'Housing', owner: 'X' }),
    )
    expect(categoryProperty(layer)).toBe('LAND_USE')
  })
  it('ignores unique identifiers and numbers', () => {
    expect(categoryProperty(fc(square({ id: 'a', n: 1 }), square({ id: 'b', n: 1 })))).toBeNull()
  })
})

describe('autoLayerStyle', () => {
  it('draws a single polygon or red line as an unfilled red outline', () => {
    expect(autoLayerStyle('site', fc(square()))).toMatchObject({ strokeColor: '#DC2626', fillOpacity: 0 })
  })
  it('colours a categorised layer by its attribute', () => {
    const style = autoLayerStyle('masterplan', fc(square({ zone: 'Residential' }), square({ zone: 'Employment' }), square({ zone: 'Residential' })))
    expect(style.colorBy?.property).toBe('zone')
    expect(Object.keys(style.colorBy!.colors)).toEqual(['Employment', 'Residential'])
    expect(featureColor(style, { zone: 'Residential' }).fill).toBe(style.colorBy!.colors.Residential)
    expect(featureColor(style, { zone: 'Unknown' }).fill).toBe(style.fillColor)
  })
})
