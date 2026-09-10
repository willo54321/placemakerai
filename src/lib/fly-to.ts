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

  // Distance drives duration and whether the flyover arc kicks in
  const latDiff = Math.abs(target.lat - startLat)
  const lngDiff = Math.abs(target.lng - startLng)
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

  const useFlyover = distance > 0.01 // ~1km
  const midZoom = useFlyover ? Math.min(startZoom, target.zoom) - 2 : null

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
