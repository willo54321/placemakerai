import { describe, it, expect } from 'vitest'
import { parseMapAreas, readMapAreas } from './map-areas'

describe('parseMapAreas', () => {
  it('accepts a clean list and keeps ids', () => {
    const result = parseMapAreas([{ id: 'west', name: ' Western site ', lat: 52.33, lng: 0.43, zoom: 15.123 }])
    expect(result).toEqual({ areas: [{ id: 'west', name: 'Western site', lat: 52.33, lng: 0.43, zoom: 15.12 }] })
  })

  it('assigns an id when none is given', () => {
    const result = parseMapAreas([{ name: 'East', lat: 52.3, lng: 0.5, zoom: 14 }])
    expect('areas' in result && result.areas[0].id).toMatch(/^area-1-/)
  })

  it('rejects bad input with a message', () => {
    expect(parseMapAreas('nope')).toEqual({ error: 'mapAreas must be a list' })
    expect(parseMapAreas([{ name: '', lat: 1, lng: 1, zoom: 10 }])).toEqual({ error: 'Each map area needs a name' })
    expect(parseMapAreas([{ name: 'X', lat: 95, lng: 1, zoom: 10 }])).toEqual({ error: 'Map area "X" has an invalid position' })
    expect(parseMapAreas([{ name: 'X', lat: 1, lng: 1, zoom: 40 }])).toEqual({ error: 'Map area "X" has an invalid zoom' })
    expect(parseMapAreas(Array.from({ length: 13 }, () => ({ name: 'A', lat: 1, lng: 1, zoom: 10 })))).toEqual({ error: 'At most 12 map areas' })
  })

  it('reads stored JSON leniently', () => {
    expect(readMapAreas(null)).toEqual([])
    expect(readMapAreas({ bad: true })).toEqual([])
  })
})
