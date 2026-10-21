import { describe, it, expect } from 'vitest'
import { PDFDocument, PDFName, PDFString } from 'pdf-lib'
import { fitAffine, frameCorners, overlayFromCorners, readGeoFrames, type GeoFrame } from './geopdf'

const BNG_WKT = 'PROJCS["British_National_Grid",GEOGCS["GCS_OSGB_1936",DATUM["D_OSGB_1936",SPHEROID["Airy_1830",6377563.396,299.3249646]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",400000.0],PARAMETER["False_Northing",-100000.0],PARAMETER["Central_Meridian",-2.0],PARAMETER["Scale_Factor",0.9996012717],PARAMETER["Latitude_Of_Origin",49.0],UNIT["Meter",1.0]]'

// The main map frame of the Sunnica East parameter plan (ArcMap 10.8 export).
const SUNNICA_EAST: GeoFrame = {
  name: 'Layers',
  bbox: [31.20396, 816.57187, 1032.13106, 22.93426],
  gpts: [52.3044, 0.42032, 52.34965, 0.42279, 52.3477, 0.516, 52.30245, 0.51343],
  lpts: [0, 1, 0, 0, 1, 0, 1, 1],
  wkt: BNG_WKT,
}

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180))

describe('fitAffine', () => {
  it('recovers an exact affine transform', () => {
    const f = ([x, y]: [number, number]): [number, number] => [2 * x - y + 5, 0.5 * x + 3 * y - 1]
    const src: Array<[number, number]> = [[0, 0], [10, 0], [0, 10], [10, 10]]
    const fit = fitAffine(src, src.map(f))
    expect(fit([3, 7])[0]).toBeCloseTo(f([3, 7])[0], 9)
    expect(fit([3, 7])[1]).toBeCloseTo(f([3, 7])[1], 9)
  })
})

describe('frameCorners', () => {
  it('shifts OSGB36 control points onto WGS84', () => {
    const c = frameCorners(SUNNICA_EAST)
    // The raw GPTS are OSGB36: on WGS84 the same corner sits ~120 m away.
    const rawTopLeft = { lat: 52.34965, lng: 0.42279 }
    expect(metres(c.tl, rawTopLeft)).toBeGreaterThan(100)
    expect(metres(c.tl, rawTopLeft)).toBeLessThan(140)
    // Matches the prototype run that was checked against the order limits shapefile.
    expect(metres(c.tl, { lat: 52.35007240, lng: 0.42108584 })).toBeLessThan(0.5)
    expect(metres(c.br, { lat: 52.30287941, lng: 0.51171746 })).toBeLessThan(0.5)
  })
})

describe('overlayFromCorners', () => {
  it('fits a rotated box to a grid-north frame', () => {
    const placement = overlayFromCorners(frameCorners(SUNNICA_EAST))
    // British National Grid north is ~2° clockwise of true north near Newmarket.
    expect(placement.rotation).toBeCloseTo(1.96, 1)
    const [[s, w], [n, e]] = placement.bounds
    expect(s).toBeLessThan(n)
    expect(w).toBeLessThan(e)
    expect(metres({ lat: s, lng: w }, { lat: 52.30383964, lng: 0.41982344 })).toBeLessThan(0.5)
  })

  it('leaves a north-up frame unrotated', () => {
    const placement = overlayFromCorners({
      tl: { lat: 51.51, lng: -0.13 }, tr: { lat: 51.51, lng: -0.11 },
      br: { lat: 51.50, lng: -0.11 }, bl: { lat: 51.50, lng: -0.13 },
    })
    expect(placement.rotation).toBeCloseTo(0, 9)
    expect(placement.bounds[0][1]).toBeCloseTo(-0.13, 9)
  })
})

describe('readGeoFrames', () => {
  it('reads georeferenced viewports, largest first', async () => {
    const doc = await PDFDocument.create()
    const page = doc.addPage([1191, 842])
    const ctx = doc.context
    const viewport = (name: string, bbox: number[], frame: GeoFrame) => ctx.obj({
      Type: 'Viewport',
      Name: PDFString.of(name),
      BBox: bbox,
      Measure: ctx.obj({
        Type: 'Measure',
        Subtype: 'GEO',
        GPTS: frame.gpts,
        LPTS: frame.lpts,
        GCS: ctx.obj({ Type: 'PROJCS', WKT: PDFString.of(BNG_WKT) }),
      }),
    })
    page.node.set(PDFName.of('VP'), ctx.obj([
      viewport('Inset', [1032, 426, 1173, 333], SUNNICA_EAST),
      viewport('Layers', SUNNICA_EAST.bbox, SUNNICA_EAST),
    ]))
    const bytes = await doc.save()
    const frames = await readGeoFrames(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer)
    expect(frames.map(f => f.name)).toEqual(['Layers', 'Inset'])
    expect(frames[0]).toMatchObject({ bbox: SUNNICA_EAST.bbox, gpts: SUNNICA_EAST.gpts, lpts: SUNNICA_EAST.lpts, wkt: BNG_WKT })
  })

  it('returns nothing for an ordinary PDF', async () => {
    const doc = await PDFDocument.create()
    doc.addPage()
    const bytes = await doc.save()
    expect(await readGeoFrames(bytes.buffer as ArrayBuffer)).toEqual([])
  })
})
