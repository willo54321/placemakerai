import { describe, it, expect } from 'vitest'
import { planarToWgs84, projectionFromWkt } from './projection'

const BNG_PRJ = 'PROJCS["British_National_Grid",GEOGCS["GCS_OSGB_1936",DATUM["D_OSGB_1936",SPHEROID["Airy_1830",6377563.396,299.3249646]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",400000.0],PARAMETER["False_Northing",-100000.0],PARAMETER["Central_Meridian",-2.0],PARAMETER["Scale_Factor",0.9996012717],PARAMETER["Latitude_Of_Origin",49.0],UNIT["Meter",1.0]]'

describe('projectionFromWkt', () => {
  it('applies the OSGB36 datum shift to British National Grid', () => {
    const shifted = projectionFromWkt(BNG_PRJ)
    const unshifted = { native: shifted.native, toWgs84: shifted.native }
    const point: [number, number] = [530080, 179820] // central London
    const [lng, lat] = planarToWgs84(shifted, point)
    const [rawLng, rawLat] = planarToWgs84(unshifted, point)
    expect(lat).toBeCloseTo(51.50, 1)
    expect(lng).toBeCloseTo(-0.12, 1)
    // OSGB36 and WGS84 differ by roughly 100-130 m across England.
    const metres = Math.hypot((lat - rawLat) * 111320, (lng - rawLng) * 111320 * Math.cos((lat * Math.PI) / 180))
    expect(metres).toBeGreaterThan(90)
    expect(metres).toBeLessThan(140)
  })
  it('passes other systems through untouched', () => {
    const wkt = 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]'
    expect(projectionFromWkt(wkt)).toEqual({ native: wkt, toWgs84: wkt })
  })
})
