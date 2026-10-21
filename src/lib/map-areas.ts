// Named map views a project offers visitors as quick jumps ("Western site",
// "Cable route"), stored on Project.mapAreas and captured from the editor map.

export interface MapArea {
  id: string
  name: string
  lat: number
  lng: number
  zoom: number
}

export const MAX_MAP_AREAS = 12
export const MAP_AREA_NAME_MAX = 60

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Validate a submitted list of areas; returns the clean list or an error message. */
export function parseMapAreas(input: unknown): { areas: MapArea[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'mapAreas must be a list' }
  if (input.length > MAX_MAP_AREAS) return { error: `At most ${MAX_MAP_AREAS} map areas` }
  const areas: MapArea[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return { error: 'Each map area must be an object' }
    const a = raw as Record<string, unknown>
    const name = typeof a.name === 'string' ? a.name.trim().slice(0, MAP_AREA_NAME_MAX) : ''
    if (!name) return { error: 'Each map area needs a name' }
    if (!isNumber(a.lat) || !isNumber(a.lng) || a.lat < -90 || a.lat > 90 || a.lng < -180 || a.lng > 180) return { error: `Map area "${name}" has an invalid position` }
    if (!isNumber(a.zoom) || a.zoom < 1 || a.zoom > 22) return { error: `Map area "${name}" has an invalid zoom` }
    const id = typeof a.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(a.id) ? a.id : `area-${areas.length + 1}-${Math.random().toString(36).slice(2, 8)}`
    areas.push({ id, name, lat: a.lat, lng: a.lng, zoom: Math.round(a.zoom * 100) / 100 })
  }
  return { areas }
}

/** Areas as stored (unknown JSON) -> typed list, dropping anything malformed. */
export function readMapAreas(stored: unknown): MapArea[] {
  const parsed = parseMapAreas(stored ?? [])
  return 'areas' in parsed ? parsed.areas : []
}
