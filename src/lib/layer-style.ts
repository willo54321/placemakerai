// Automatic styling for imported GIS layers. A site/red-line boundary is drawn
// the way planning drawings show it (red outline, no fill); a layer whose
// features share a category attribute (land use, phase, zone…) is coloured
// by that attribute, with the mapping kept on the layer for the legend.

export interface LayerStyle {
  fillColor: string
  strokeColor: string
  fillOpacity: number
  strokeWidth: number
  /** Per-feature colours keyed by the value of one attribute. */
  colorBy?: { property: string; colors: Record<string, string> }
}

export const DEFAULT_LAYER_STYLE: LayerStyle = {
  fillColor: '#3B82F6',
  strokeColor: '#1E40AF',
  fillOpacity: 0.3,
  strokeWidth: 2,
}

const RED_LINE_STYLE: LayerStyle = {
  fillColor: '#DC2626',
  strokeColor: '#DC2626',
  fillOpacity: 0,
  strokeWidth: 3,
}

// Distinct, map-legible categorical colours (no reds: red means the boundary).
export const CATEGORY_PALETTE = [
  '#2563EB', '#16A34A', '#F59E0B', '#9333EA', '#0891B2', '#DB2777',
  '#65A30D', '#EA580C', '#4F46E5', '#0D9488', '#CA8A04', '#7C3AED',
]

const RED_LINE_RE = /red[\s_-]?line|order[\s_-]?limit|site[\s_-]?boundary|application[\s_-]?boundary|planning[\s_-]?boundary|development[\s_-]?boundary|dco[\s_-]?boundary/i
const CATEGORY_FIELD_RE = /land[\s_-]?use|use|zone|zoning|type|class|category|phase|parcel|designation|status|descr/i
const MAX_CATEGORIES = CATEGORY_PALETTE.length

const isPolygonal = (f: GeoJSON.Feature) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'

/** Whether a layer looks like a site / red-line boundary. */
export function isBoundaryLayer(name: string, fc: GeoJSON.FeatureCollection): boolean {
  if (RED_LINE_RE.test(name)) return true
  return fc.features.some(f =>
    Object.values(f.properties ?? {}).some(v => typeof v === 'string' && RED_LINE_RE.test(v))
  )
}

/**
 * The attribute best suited to colour features by: a text field with a small
 * number of repeated values. Fields named like land use / zone / phase win.
 */
export function categoryProperty(fc: GeoJSON.FeatureCollection): string | null {
  const features = fc.features
  if (features.length < 2) return null
  const candidates: Array<{ key: string; distinct: number; preferred: boolean }> = []
  const keys = new Set(features.flatMap(f => Object.keys(f.properties ?? {})))
  keys.forEach(key => {
    const values = features.map(f => f.properties?.[key])
    if (!values.every(v => typeof v === 'string' && v.trim())) return
    const distinct = new Set(values as string[]).size
    if (distinct < 2 || distinct > MAX_CATEGORIES || distinct === features.length) return
    candidates.push({ key, distinct, preferred: CATEGORY_FIELD_RE.test(key) })
  })
  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.distinct - b.distinct)
  return candidates[0]?.key ?? null
}

/** Style for a freshly imported layer. */
export function autoLayerStyle(name: string, fc: GeoJSON.FeatureCollection): LayerStyle {
  const polygonal = fc.features.length > 0 && fc.features.every(isPolygonal)
  if (polygonal && (isBoundaryLayer(name, fc) || fc.features.length === 1)) return { ...RED_LINE_STYLE }

  const property = categoryProperty(fc)
  if (!property) return { ...DEFAULT_LAYER_STYLE }
  const values = Array.from(new Set(fc.features.map(f => String(f.properties?.[property])))).sort()
  const colors = Object.fromEntries(values.map((v, i) => [v, CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]]))
  return { ...DEFAULT_LAYER_STYLE, fillOpacity: 0.35, strokeWidth: 1.5, colorBy: { property, colors } }
}

/** Fill/stroke colour for one feature under a layer style. */
export function featureColor(style: Partial<LayerStyle> | null | undefined, properties: GeoJSON.GeoJsonProperties): { fill: string; stroke: string } {
  const fill = style?.fillColor || DEFAULT_LAYER_STYLE.fillColor
  const stroke = style?.strokeColor || DEFAULT_LAYER_STYLE.strokeColor
  const by = style?.colorBy
  const value = by ? properties?.[by.property] : undefined
  const mapped = by && value != null ? by.colors[String(value)] : undefined
  return mapped ? { fill: mapped, stroke: mapped } : { fill, stroke }
}
