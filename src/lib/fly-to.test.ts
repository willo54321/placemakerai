import { describe, it, expect } from 'vitest'
import { flyPath } from './fly-to'

const viewport = { width: 1200, height: 800 }
const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180))

const sample = (path: ReturnType<typeof flyPath>, n = 50) => Array.from({ length: n + 1 }, (_, i) => path.at(i / n))

describe('flyPath', () => {
  const from = { lat: 52.33, lng: 0.43, zoom: 16 }
  const to = { lat: 52.315, lng: 0.48, zoom: 15.5 }

  it('starts and ends exactly at the two cameras', () => {
    const path = flyPath(from, to, viewport)
    const start = path.at(0), end = path.at(1)
    expect(metres(start, from)).toBeLessThan(0.5)
    expect(start.zoom).toBeCloseTo(16, 6)
    expect(end).toEqual(to)
  })

  it('pulls back mid-flight on a hop longer than the screen, but only modestly', () => {
    const lowest = Math.min(...sample(flyPath(from, to, viewport)).map(c => c.zoom))
    expect(lowest).toBeLessThan(15.5)
    expect(lowest).toBeGreaterThan(13)
  })

  it('barely zooms out on a short hop', () => {
    const near = { lat: 52.3305, lng: 0.432, zoom: 16 }
    const lowest = Math.min(...sample(flyPath(from, near, viewport)).map(c => c.zoom))
    expect(lowest).toBeGreaterThan(15.7)
  })

  it('keeps on-screen speed even, instead of lurching at the ends', () => {
    // On-screen pan per step = ground distance scaled by zoom. Interpolating
    // centre and zoom separately varied this ~4-5x across a hop.
    const speedSpread = (a: typeof from, b: typeof from) => {
      const cams = sample(flyPath(a, b, viewport), 60)
      const px = cams.slice(1).map((c, i) => metres(c, cams[i]) * Math.pow(2, (c.zoom + cams[i].zoom) / 2))
      return Math.max(...px) / Math.min(...px)
    }
    expect(speedSpread(from, to)).toBeLessThan(3)
    expect(speedSpread({ lat: 52.33, lng: 0.43, zoom: 15 }, { lat: 52.335, lng: 0.45, zoom: 15 })).toBeLessThan(1.3)
  })

  it('takes longer for longer journeys, within limits', () => {
    const short = flyPath(from, { ...from, lng: 0.44 }, viewport).duration
    const long = flyPath(from, { ...from, lng: 0.7 }, viewport).duration
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(2600)
    expect(short).toBeGreaterThanOrEqual(600)
  })

  it('handles a pure zoom and no movement', () => {
    const zoomOnly = flyPath(from, { ...from, zoom: 13 }, viewport)
    expect(zoomOnly.at(0.5).zoom).toBeLessThan(16)
    expect(zoomOnly.at(0.5).zoom).toBeGreaterThan(13)
    expect(flyPath(from, from, viewport).duration).toBe(0)
  })
})
