// Cinematic camera animation shared by the public embed map and the admin
// editor map. Interpolates centre and zoom with cubic easing; longer hops get
// a flyover (zoom out over the journey, zoom back in on arrival). Fractional
// zoom must be enabled on the map (isFractionalZoomEnabled) or raster
// rendering rounds the interpolated zoom to whole levels and the motion steps.

export interface FlyToTarget {
  lat: number
  lng: number
  zoom: number
}

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Web Mercator ground resolution at zoom 0 on the equator, metres per pixel
const METRES_PER_PIXEL_Z0 = 156543.03392

/**
 * The zoom to pass through mid-flight so both ends stay on screen, or null
 * when no zoom-out is needed. Every zoom level crossed means fetching a fresh
 * set of map tiles mid-move (very visible on satellite), so the camera only
 * pulls back as far as the hop requires — never a fixed amount.
 */
export function flyoverZoom(
  from: { lat: number; lng: number; zoom: number },
  to: FlyToTarget,
  viewport: { width: number; height: number },
): number | null {
  const lat = ((from.lat + to.lat) / 2) * (Math.PI / 180)
  const dy = (to.lat - from.lat) * 111320
  const dx = (to.lng - from.lng) * 111320 * Math.cos(lat)
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null
  // Mid-flight the centre is halfway, so each end is distance/2 away; keep it
  // within 40% of the shorter side of the map.
  const fitZoom = Math.log2((METRES_PER_PIXEL_Z0 * Math.cos(lat) * 0.8 * Math.min(viewport.width, viewport.height)) / distance)
  const lower = Math.min(from.zoom, to.zoom)
  return fitZoom < lower - 0.25 ? fitZoom : null
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

  const startLat = currentCenter.lat()
  const startLng = currentCenter.lng()
  const startZoom = currentZoom

  // Distance drives duration; the flyover arc only kicks in when the two ends
  // won't both fit on screen at the shallower zoom.
  const latDiff = Math.abs(target.lat - startLat)
  const lngDiff = Math.abs(target.lng - startLng)
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

  const div = map.getDiv()
  const midZoom = flyoverZoom(
    { lat: startLat, lng: startLng, zoom: startZoom },
    target,
    { width: div.clientWidth || 800, height: div.clientHeight || 600 },
  )
  const useFlyover = midZoom !== null

  // 1.2s base, up to 2.5s for long hops
  const duration = Math.min(1200 + distance * 50000, 2500)

  let animationFrame = 0
  const startTime = performance.now()

  const animate = (currentTime: number) => {
    const rawProgress = Math.min((currentTime - startTime) / duration, 1)
    const progress = easeInOutCubic(rawProgress)

    map.setCenter({
      lat: startLat + (target.lat - startLat) * progress,
      lng: startLng + (target.lng - startLng) * progress,
    })

    if (useFlyover && midZoom !== null) {
      // First half eases out to the flyover altitude, second half eases in
      map.setZoom(
        progress < 0.5
          ? startZoom + (midZoom - startZoom) * (progress * 2)
          : midZoom + (target.zoom - midZoom) * ((progress - 0.5) * 2)
      )
    } else {
      map.setZoom(startZoom + (target.zoom - startZoom) * progress)
    }

    if (rawProgress < 1) {
      animationFrame = requestAnimationFrame(animate)
    }
  }

  animationFrame = requestAnimationFrame(animate)
  return () => cancelAnimationFrame(animationFrame)
}
