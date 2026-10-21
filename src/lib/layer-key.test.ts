import { describe, it, expect } from 'vitest'
import { cleanLayerName, dominantColor } from './layer-key'

describe('cleanLayerName', () => {
  it('turns GIS layer names into readable labels', () => {
    expect(cleanLayerName('SEF_ACM_HedgerowWithScatteredTrees_Ply')).toBe('Hedgerow With Scattered Trees')
    expect(cleanLayerName('SEF_ES_ACM_OfficeWarehouse_Ply')).toBe('Office Warehouse')
    expect(cleanLayerName('SEF_ACM_StrategicEnvironmentalPlan_200708_Ply')).toBe('Strategic Environmental Plan')
    expect(cleanLayerName('Proposed Road   ')).toBe('Proposed Road')
    expect(cleanLayerName('Developable Area  - Default')).toBe('Developable Area - Default')
    expect(cleanLayerName('BESS and Substation')).toBe('BESS and Substation')
  })
})

describe('dominantColor', () => {
  const px = (...pixels: Array<[number, number, number, number]>) => new Uint8ClampedArray(pixels.flat())

  it('returns null for a fully transparent layer', () => {
    expect(dominantColor(px([0, 0, 0, 0], [0, 0, 0, 0]), 1)).toBeNull()
  })

  it('picks the most common opaque colour and ignores white', () => {
    const data = px([255, 255, 255, 255], [255, 255, 255, 255], [16, 120, 200, 255], [18, 122, 198, 255], [200, 20, 20, 255])
    const result = dominantColor(data, 1)!
    expect(result.hex).toBe('#147ccc')
    expect(result.coverage).toBe(1)
  })

  it('falls back to a light swatch when only white is drawn', () => {
    expect(dominantColor(px([255, 255, 255, 255], [0, 0, 0, 0]), 1)).toEqual({ hex: '#e2e8f0', coverage: 0.5 })
  })
})
