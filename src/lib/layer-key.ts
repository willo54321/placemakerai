// Helpers for a toggleable map key built from a plan's drawing layers: a
// readable name for each GIS layer, and the colour to show as its swatch.

/**
 * A human-readable name for a GIS/CAD layer: drops short uppercase code
 * prefixes and geometry suffixes, splits CamelCase, and tidies whitespace.
 *   "SEF_ACM_HedgerowWithScatteredTrees_Ply" -> "Hedgerow With Scattered Trees"
 *   "Proposed Road   "                        -> "Proposed Road"
 */
export function cleanLayerName(raw: string): string {
  let name = raw.trim()
  if (name.includes('_')) {
    const parts = name.split('_').filter(Boolean)
    // Leading tokens that are short all-caps codes (SEF, ACM, ES…)
    while (parts.length > 1 && /^[A-Z0-9]{1,4}$/.test(parts[0])) parts.shift()
    // Trailing geometry/date tokens (Ply, Pt, Ln, 200708)
    while (parts.length > 1 && /^(ply|poly|pt|pts|ln|line|\d{4,})$/i.test(parts[parts.length - 1])) parts.pop()
    name = parts.join(' ')
  }
  // CamelCase -> words
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  return name.replace(/\s+/g, ' ').trim()
}

/**
 * The colour a rendered layer should get as its key swatch: the most common
 * opaque colour, ignoring white (label halos, hatch backgrounds) unless
 * nothing else is drawn. Returns null for an empty layer.
 */
export function dominantColor(rgba: Uint8ClampedArray | Uint8Array, step = 4): { hex: string; coverage: number } | null {
  const counts = new Map<number, number>()
  let opaque = 0
  let sampled = 0
  for (let i = 0; i < rgba.length; i += 4 * step) {
    sampled++
    if (rgba[i + 3] < 128) continue
    opaque++
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
    if (r > 235 && g > 235 && b > 235) continue
    // Quantise to 5 bits per channel so anti-aliased shades merge
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  if (opaque === 0) return null
  const coverage = opaque / sampled
  let best: number | null = null, bestCount = 0
  counts.forEach((count, key) => { if (count > bestCount) { best = key; bestCount = count } })
  if (best === null) return { hex: '#e2e8f0', coverage } // only white was drawn
  const k = best as number
  const channel = (v: number) => Math.min(255, (v << 3) + 4).toString(16).padStart(2, '0')
  return { hex: `#${channel(k >> 10)}${channel((k >> 5) & 31)}${channel(k & 31)}`, coverage }
}
