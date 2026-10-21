import proj4 from 'proj4'

// Coordinate systems for UK/Irish GIS files. Their .prj / GeoPDF WKT names the
// datum but carries no TOWGS84 shift, so proj4 reads OSGB36 coordinates as if
// they were WGS84 — about 120 m out on Google Maps. These helpers swap in
// definitions with the published 7-parameter Helmert shift (accurate to a few
// metres, plenty for consultation maps).

const OSGB36_TOWGS84 = '446.448,-125.157,542.06,0.15,0.247,0.842,-20.489'
const TM65_TOWGS84 = '482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15'

const BNG = '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +units=m +no_defs'
const IRISH_GRID = '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +ellps=mod_airy +units=m +no_defs'

export interface Projection {
  /** The coordinate system in its own datum (no shift to WGS84). */
  native: string
  /** The same system with its datum shift, for converting to WGS84. */
  toWgs84: string
}

/**
 * Projection definitions for a WKT string (.prj contents or a GeoPDF GCS).
 * Known UK/Irish systems get explicit definitions with their datum shift;
 * anything else is passed through for proj4 to parse as-is.
 */
export function projectionFromWkt(wkt: string): Projection {
  const isProjected = /^\s*PROJCS/i.test(wkt)
  if (/OSGB[_ ]?1936|OSGB36/i.test(wkt)) {
    if (!isProjected) {
      const native = '+proj=longlat +ellps=airy +no_defs'
      return { native, toWgs84: `${native} +towgs84=${OSGB36_TOWGS84}` }
    }
    if (/British_National_Grid|OSGB_1936_British_National_Grid|27700/i.test(wkt)) {
      return { native: BNG, toWgs84: `${BNG} +towgs84=${OSGB36_TOWGS84}` }
    }
  }
  if (/TM65|Ireland_1965/i.test(wkt)) {
    if (!isProjected) {
      const native = '+proj=longlat +ellps=mod_airy +no_defs'
      return { native, toWgs84: `${native} +towgs84=${TM65_TOWGS84}` }
    }
    if (/Irish_Grid|Irish_National_Grid|29902|29903/i.test(wkt)) {
      return { native: IRISH_GRID, toWgs84: `${IRISH_GRID} +towgs84=${TM65_TOWGS84}` }
    }
  }
  return { native: wkt, toWgs84: wkt }
}

/** [lng, lat] in the projection's own datum (degrees) -> its planar coordinates. */
export function nativeGeographicToPlanar(projection: Projection, lngLat: [number, number]): [number, number] {
  // Neither side of this conversion has a datum shift, so proj4 only projects.
  const noShiftGeographic = '+proj=longlat +ellps=WGS84 +no_defs'
  if (projection.native.includes('+proj=longlat')) return lngLat
  const ellps = projection.native.match(/\+ellps=(\S+)/)?.[1]
  const from = ellps ? `+proj=longlat +ellps=${ellps} +no_defs` : noShiftGeographic
  return proj4(from, projection.native, lngLat) as [number, number]
}

/** Planar (or native geographic) coordinates -> WGS84 [lng, lat]. */
export function planarToWgs84(projection: Projection, xy: [number, number]): [number, number] {
  return proj4(projection.toWgs84, 'WGS84', xy) as [number, number]
}
