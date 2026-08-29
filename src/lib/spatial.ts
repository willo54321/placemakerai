/**
 * Spatial naming for analysis findings.
 *
 * The cross-reference engine reports geographic findings against rounded grid
 * cells ("51.50,-0.10"), which is meaningless to a planning officer. These
 * helpers turn a cell into a plain-language place relative to the site — "the
 * north-east corner of the site", "just south of the site" — using the
 * project's red-line boundary (or, failing that, the spread of located
 * responses) as the frame of reference. Everything here is deterministic and
 * computed in code; no model call is involved in naming.
 */

export interface LatLng {
  latitude: number
  longitude: number
}

export interface SiteContext {
  centroid: LatLng
  /** Characteristic size: the furthest boundary vertex from the centroid. */
  radiusKm: number
}

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Great-circle distance. Sub-metre precision is irrelevant at naming scale. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial great-circle bearing from `from` to `to`, degrees clockwise from north. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const φ1 = toRad(from.latitude)
  const φ2 = toRad(to.latitude)
  const Δλ = toRad(to.longitude - from.longitude)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (Math.atan2(y, x) * 180) / Math.PI + (Math.atan2(y, x) < 0 ? 360 : 0)
}

const COMPASS_8 = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const

export type CompassName = (typeof COMPASS_8)[number]

export function compassName(bearing: number): CompassName {
  const normalized = ((bearing % 360) + 360) % 360
  return COMPASS_8[Math.round(normalized / 45) % 8]
}

/**
 * Pull every [lng, lat] position out of arbitrary GeoJSON — geometry,
 * Feature, or FeatureCollection — without caring about its exact shape.
 */
export function extractPositions(geojson: unknown): LatLng[] {
  const out: LatLng[] = []

  const walk = (node: unknown): void => {
    if (!node) return
    if (Array.isArray(node)) {
      if (
        node.length >= 2 &&
        typeof node[0] === 'number' &&
        typeof node[1] === 'number'
      ) {
        // GeoJSON positions are [longitude, latitude]
        const longitude = node[0]
        const latitude = node[1]
        if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
          out.push({ latitude, longitude })
        }
        return
      }
      node.forEach(walk)
      return
    }
    if (typeof node === 'object') {
      const record = node as Record<string, unknown>
      walk(record.coordinates)
      walk(record.geometry)
      walk(record.features)
    }
  }

  walk(geojson)
  return out
}

export function centroidOf(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null
  const sum = points.reduce(
    (acc, p) => ({ latitude: acc.latitude + p.latitude, longitude: acc.longitude + p.longitude }),
    { latitude: 0, longitude: 0 }
  )
  return { latitude: sum.latitude / points.length, longitude: sum.longitude / points.length }
}

/**
 * Establish the frame of reference for naming: the boundary layer when the
 * project has one, otherwise the spread of located responses. Returns null
 * when there is nothing to anchor to.
 */
export function siteContext(
  boundaryGeojson: unknown | null,
  fallbackPoints: LatLng[]
): SiteContext | null {
  const boundaryPoints = boundaryGeojson ? extractPositions(boundaryGeojson) : []
  const points = boundaryPoints.length >= 3 ? boundaryPoints : fallbackPoints
  const centroid = centroidOf(points)
  if (!centroid) return null

  const radiusKm = Math.max(
    0.15, // never let a tiny site collapse the bands to zero
    ...points.map(p => distanceKm(centroid, p))
  )
  return { centroid, radiusKm }
}

/**
 * Name a grid cell relative to the site. Diagonal directions read as corners,
 * cardinals as edges — matching how people actually describe a site plan.
 */
export function areaLabel(cell: LatLng, site: SiteContext): string {
  const d = distanceKm(site.centroid, cell)
  if (d < 0.3 * site.radiusKm) return 'the centre of the site'

  const name = compassName(bearingDegrees(site.centroid, cell))
  const diagonal = name.includes('-')

  if (d <= 1.2 * site.radiusKm) {
    return diagonal ? `the ${name} corner of the site` : `the ${name}ern edge of the site`
  }
  if (d <= 3 * site.radiusKm) {
    return `just ${name} of the site`
  }
  return `${name} of the site (~${d < 10 ? d.toFixed(1) : Math.round(d)} km away)`
}
