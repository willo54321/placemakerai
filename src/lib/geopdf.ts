import { nativeGeographicToPlanar, planarToWgs84, projectionFromWkt } from './projection'

// Georeferenced PDFs (ISO 32000 geospatial: a page /VP viewport with a /GEO
// /Measure). ArcGIS and QGIS write these by default, which covers most
// masterplans and DCO parameter plans: each map frame on the page records
// control points (GPTS, lat/lng in the frame's own datum) at known positions
// inside it (LPTS), plus the coordinate system as WKT. From those we place the
// frame on the map exactly instead of asking someone to drag it into place.

export interface GeoFrame {
  name: string
  /** Frame rectangle in PDF user space, as written: [x1, y1, x2, y2]. */
  bbox: [number, number, number, number]
  /** Control points as lat, lng pairs in the frame's datum. */
  gpts: number[]
  /** Control point positions as fractions of bbox (x, y pairs, relative to x1/y1). */
  lpts: number[]
  /** Coordinate system WKT (PROJCS or GEOGCS); null means plain WGS84 lat/lng. */
  wkt: string | null
}

export interface LatLng { lat: number; lng: number }
export interface FrameCorners { tl: LatLng; tr: LatLng; br: LatLng; bl: LatLng }

/** Frame rectangle normalised to PDF user space with y up. */
export function frameRect(frame: GeoFrame) {
  const [x1, y1, x2, y2] = frame.bbox
  return { left: Math.min(x1, x2), right: Math.max(x1, x2), bottom: Math.min(y1, y2), top: Math.max(y1, y2) }
}

type Affine = (p: [number, number]) => [number, number]

/** Least-squares affine transform mapping src points onto dst points (needs 3+). */
export function fitAffine(src: Array<[number, number]>, dst: Array<[number, number]>): Affine {
  if (src.length < 3) throw new Error('At least three control points are needed')
  const ata = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const atx = [0, 0, 0]
  const aty = [0, 0, 0]
  src.forEach(([x, y], i) => {
    const row = [x, y, 1]
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) ata[j][k] += row[j] * row[k]
      atx[j] += row[j] * dst[i][0]
      aty[j] += row[j] * dst[i][1]
    }
  })
  const solve = (rhs: number[]) => {
    const m = ata.map((r, i) => [...r, rhs[i]])
    for (let col = 0; col < 3; col++) {
      let pivot = col
      for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r
      ;[m[col], m[pivot]] = [m[pivot], m[col]]
      if (Math.abs(m[col][col]) < 1e-12) throw new Error('Control points are collinear')
      for (let r = 0; r < 3; r++) {
        if (r === col) continue
        const factor = m[r][col] / m[col][col]
        for (let c = col; c < 4; c++) m[r][c] -= factor * m[col][c]
      }
    }
    return m.map((r, i) => r[3] / r[i])
  }
  const cx = solve(atx)
  const cy = solve(aty)
  return ([x, y]) => [cx[0] * x + cx[1] * y + cx[2], cy[0] * x + cy[1] * y + cy[2]]
}

/**
 * WGS84 positions of a frame's four corners. Control points are projected
 * into the frame's own coordinate system (where the map is drawn linearly),
 * an affine fit maps PDF space onto it, and the corners are then converted
 * to WGS84 with the datum shift applied.
 */
export function frameCorners(frame: GeoFrame): FrameCorners {
  const projection = projectionFromWkt(frame.wkt ?? 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]')
  const [x1, y1, x2, y2] = frame.bbox
  const pdfPoints: Array<[number, number]> = []
  const planarPoints: Array<[number, number]> = []
  for (let i = 0; i + 1 < Math.min(frame.lpts.length, frame.gpts.length); i += 2) {
    pdfPoints.push([x1 + frame.lpts[i] * (x2 - x1), y1 + frame.lpts[i + 1] * (y2 - y1)])
    planarPoints.push(nativeGeographicToPlanar(projection, [frame.gpts[i + 1], frame.gpts[i]]))
  }
  const toPlanar = fitAffine(pdfPoints, planarPoints)
  const r = frameRect(frame)
  const corner = (x: number, y: number): LatLng => {
    const [lng, lat] = planarToWgs84(projection, toPlanar([x, y]))
    return { lat, lng }
  }
  return {
    tl: corner(r.left, r.top),
    tr: corner(r.right, r.top),
    br: corner(r.right, r.bottom),
    bl: corner(r.left, r.bottom),
  }
}

const toMercator = ({ lat, lng }: LatLng): [number, number] => [
  (lng * Math.PI) / 180,
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
]
const fromMercator = ([x, y]: [number, number]): LatLng => ({
  lng: (x * 180) / Math.PI,
  lat: ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI,
})

/**
 * Map overlay placement for a frame: our overlays are an unrotated
 * [[south, west], [north, east]] box in Web Mercator, CSS-rotated clockwise
 * about its centre — so solve for the box and angle that best fit the four
 * corners. (A grid-north plan sits ~2° off true north in East Anglia.)
 */
export function overlayFromCorners(c: FrameCorners): { bounds: [[number, number], [number, number]]; rotation: number } {
  const [tl, tr, br, bl] = [c.tl, c.tr, c.br, c.bl].map(toMercator)
  const cx = (tl[0] + tr[0] + br[0] + bl[0]) / 4
  const cy = (tl[1] + tr[1] + br[1] + bl[1]) / 4
  const width = (Math.hypot(tr[0] - tl[0], tr[1] - tl[1]) + Math.hypot(br[0] - bl[0], br[1] - bl[1])) / 2
  const height = (Math.hypot(tl[0] - bl[0], tl[1] - bl[1]) + Math.hypot(tr[0] - br[0], tr[1] - br[1])) / 2
  // Mercator y points up, screen y down: an anticlockwise top edge is a negative CSS rotation.
  const angle = Math.atan2((tr[1] - tl[1] + br[1] - bl[1]) / 2, (tr[0] - tl[0] + br[0] - bl[0]) / 2)
  const sw = fromMercator([cx - width / 2, cy - height / 2])
  const ne = fromMercator([cx + width / 2, cy + height / 2])
  return { bounds: [[sw.lat, sw.lng], [ne.lat, ne.lng]], rotation: (-angle * 180) / Math.PI }
}

/**
 * The georeferenced map frames on one page, largest first (the main map
 * before any locator inset). Empty when the PDF isn't georeferenced.
 */
export async function readGeoFrames(bytes: ArrayBuffer, pageIndex = 0): Promise<GeoFrame[]> {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFRef, PDFString, PDFHexString } = await import('pdf-lib')
  const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
  const page = doc.getPage(pageIndex)
  const look = (o: unknown) => (o instanceof PDFRef ? doc.context.lookup(o) : o)
  const dict = (o: unknown) => { const v = look(o); return v instanceof PDFDict ? v : null }
  const numbers = (o: unknown) => {
    const v = look(o)
    return v instanceof PDFArray ? v.asArray().map(n => { const x = look(n); return x instanceof PDFNumber ? x.asNumber() : NaN }) : []
  }
  const text = (o: unknown) => {
    const v = look(o)
    if (v instanceof PDFString || v instanceof PDFHexString) return v.decodeText()
    return v instanceof PDFName ? v.decodeText() : null
  }

  const viewports = look(page.node.get(PDFName.of('VP')))
  if (!(viewports instanceof PDFArray)) return []
  const frames: Array<GeoFrame & { area: number }> = []
  for (const entry of viewports.asArray()) {
    const vp = dict(entry)
    const measure = dict(vp?.get(PDFName.of('Measure')))
    if (!vp || !measure || text(measure.get(PDFName.of('Subtype'))) !== 'GEO') continue
    const bbox = numbers(vp.get(PDFName.of('BBox')))
    const gpts = numbers(measure.get(PDFName.of('GPTS')))
    const lpts = numbers(measure.get(PDFName.of('LPTS')))
    if (bbox.length !== 4 || gpts.length < 6 || lpts.length < 6 || [...bbox, ...gpts, ...lpts].some(Number.isNaN)) continue
    const gcs = dict(measure.get(PDFName.of('GCS')))
    frames.push({
      name: text(vp.get(PDFName.of('Name'))) ?? '',
      bbox: bbox as GeoFrame['bbox'],
      gpts,
      lpts,
      wkt: gcs ? text(gcs.get(PDFName.of('WKT'))) : null,
      area: Math.abs((bbox[2] - bbox[0]) * (bbox[3] - bbox[1])),
    })
  }
  return frames.sort((a, b) => b.area - a.area).map(({ area: _area, ...frame }) => frame)
}
