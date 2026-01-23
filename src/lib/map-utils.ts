import * as turf from '@turf/turf'

export function calculateDrawingMetrics(geometry: GeoJSON.Geometry): { area?: number; length?: number } {
  try {
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      const area = turf.area(geometry as any)
      return { area: Math.round(area) }
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
      const length = turf.length(geometry as any, { units: 'meters' })
      return { length: Math.round(length) }
    }
  } catch (e) {
    console.error('Error calculating metrics:', e)
  }
  return {}
}
