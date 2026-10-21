// Cinematic camera animation shared by the public embed map and the admin
// editor map. Pan and zoom follow one optimal path (van Wijk & Nuij, "Smooth
// and efficient zooming and panning", 2003 — the curve Mapbox's flyTo uses):
// the camera pulls back only as far as the hop needs and the content moves
// across the screen at a steady speed. Interpolating centre and zoom
// separately makes the map lurch at the ends of a hop and crawl in the middle,
// because a given ground distance is many more pixels when zoomed in.
// Fractional zoom must be enabled on the map (isFractionalZoomEnabled) or
// raster rendering rounds the interpolated zoom to whole levels.

export interface FlyToTarget {
  lat: number
  lng: number
  zoom: number
}

/** Curvature of the zoom-out arc; 1.42 is the value van Wijk & Nuij found most natural. */
const RHO = 1.42
/** Average speed, in screen-widths per second along the path. */
const SPEED = 1.2
const MIN_DURATION = 600
const MAX_DURATION = 2600

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Web Mercator, in zoom-0 world pixels (the world is 256px wide at zoom 0)
const toWorld = (lat: number, lng: number) => {
  const sin = Math.sin((lat * Math.PI) / 180)
  return { x: ((lng + 180) / 360) * 256, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 }
}
const fromWorld = (x: number, y: number) => ({
  lng: (x / 256) * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 256))) * 180) / Math.PI,
})

export interface FlyPath {
  /** Milliseconds the flight should take. */
  duration: number
  /** Camera at path progress t (0–1, already eased). */
  at: (t: number) => FlyToTarget
}

/** The optimal pan–zoom path between two cameras for a viewport of the given size. */
export function flyPath(from: FlyToTarget, to: FlyToTarget, viewport: { width: number; height: number }): FlyPath {
  const a = toWorld(from.lat, from.lng)
  const b = toWorld(to.lat, to.lng)
  // Work in screen pixels at the starting zoom
  const scale0 = Math.pow(2, from.zoom)
  const w0 = Math.max(viewport.width, viewport.height)
  const w1 = w0 / Math.pow(2, to.zoom - from.zoom)
  const u1 = Math.hypot(b.x - a.x, b.y - a.y) * scale0
  const rho2 = RHO * RHO

  const r = (i: 0 | 1) => {
    const bi = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1)
    return Math.log(Math.sqrt(bi * bi + 1) - bi)
  }

  let width: (s: number) => number // visible width relative to the start
  let along: (s: number) => number // fraction of the distance covered
  let S: number

  const r0 = u1 > 1e-6 ? r(0) : NaN
  S = (r(1) - r0) / RHO
  if (u1 <= 1e-6 || !Number.isFinite(S)) {
    // No real pan: a pure zoom
    const k = w1 < w0 ? -1 : 1
    S = Math.abs(Math.log(w1 / w0)) / RHO
    width = s => Math.exp(k * RHO * s)
    along = () => 1
  } else {
    width = s => Math.cosh(r0) / Math.cosh(r0 + RHO * s)
    along = s => (w0 * ((Math.cosh(r0) * Math.tanh(r0 + RHO * s) - Math.sinh(r0)) / rho2)) / u1
  }

  const duration = Math.min(MAX_DURATION, Math.max(MIN_DURATION, (S / SPEED) * 1000))
  return {
    duration: S > 0 ? duration : 0,
    at: t => {
      if (t >= 1) return { ...to }
      const s = t * S
      const f = Math.min(1, Math.max(0, along(s)))
      const centre = fromWorld(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)
      // width(s) shrinks as we zoom in, so zoom = start zoom + log2(1/width)
      return { lat: centre.lat, lng: centre.lng, zoom: from.zoom - Math.log2(width(s)) }
    },
  }
}

/**
 * Animate the map camera to `target`. Returns a cancel function — call it on
 * cleanup so an interrupted flight stops instead of fighting the next one.
 */
export function startFlyTo(map: google.maps.Map, target: FlyToTarget): () => void {
  const currentCenter = map.getCenter()
  const currentZoom = map.getZoom() ?? 15

  if (!currentCenter) {
    map.setCenter({ lat: target.lat, lng: target.lng })
    map.setZoom(target.zoom)
    return () => {}
  }

  const div = map.getDiv()
  const path = flyPath(
    { lat: currentCenter.lat(), lng: currentCenter.lng(), zoom: currentZoom },
    target,
    { width: div.clientWidth || 800, height: div.clientHeight || 600 },
  )
  if (path.duration === 0) {
    map.moveCamera({ center: { lat: target.lat, lng: target.lng }, zoom: target.zoom })
    return () => {}
  }

  let animationFrame = 0
  const startTime = performance.now()

  const animate = (currentTime: number) => {
    const raw = Math.min((currentTime - startTime) / path.duration, 1)
    const camera = path.at(easeInOutCubic(raw))
    // One camera update per frame, centre and zoom together
    map.moveCamera({ center: { lat: camera.lat, lng: camera.lng }, zoom: camera.zoom })
    if (raw < 1) animationFrame = requestAnimationFrame(animate)
  }

  animationFrame = requestAnimationFrame(animate)
  return () => cancelAnimationFrame(animationFrame)
}
