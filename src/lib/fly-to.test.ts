import { describe, it, expect } from 'vitest'
import { flyoverZoom } from './fly-to'

const viewport = { width: 1200, height: 800 }

describe('flyoverZoom', () => {
  it('does not zoom out when both ends already fit on screen', () => {
    // ~700 m apart at zoom 15: well within one screen
    expect(flyoverZoom({ lat: 52.32, lng: 0.46, zoom: 15 }, { lat: 52.326, lng: 0.462, zoom: 15 }, viewport)).toBeNull()
  })

  it('pulls back only as far as the hop needs', () => {
    // ~3.7 km at zoom 16: needs a modest pull-back, not a fixed two levels from 16
    const z = flyoverZoom({ lat: 52.33, lng: 0.43, zoom: 16 }, { lat: 52.315, lng: 0.48, zoom: 16 }, viewport)!
    expect(z).toBeGreaterThan(13.5)
    expect(z).toBeLessThan(15)
  })

  it('pulls back further for long hops', () => {
    const near = flyoverZoom({ lat: 52.3, lng: 0.4, zoom: 16 }, { lat: 52.3, lng: 0.45, zoom: 16 }, viewport)!
    const far = flyoverZoom({ lat: 52.3, lng: 0.4, zoom: 16 }, { lat: 52.3, lng: 0.7, zoom: 16 }, viewport)!
    expect(far).toBeLessThan(near)
  })

  it('is null for no movement', () => {
    expect(flyoverZoom({ lat: 52, lng: 0, zoom: 15 }, { lat: 52, lng: 0, zoom: 12 }, viewport)).toBeNull()
  })
})
