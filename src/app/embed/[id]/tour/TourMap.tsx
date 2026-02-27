'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, PolygonF } from '@react-google-maps/api'
import { RotatableOverlay } from '@/components/RotatableOverlay'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry")[] = ['drawing', 'geometry']

interface Overlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  rotation: number
}

interface HighlightGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

interface TourMapProps {
  center: [number, number]
  zoom: number
  overlays: Overlay[]
  mapType: 'roadmap' | 'satellite'
  animateToCenter?: boolean
  highlight?: HighlightGeometry | null
}

export default function TourMap({
  center,
  zoom,
  overlays,
  mapType,
  animateToCenter = false,
  highlight = null
}: TourMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const overlayRefs = useRef<Map<string, RotatableOverlay>>(new Map())

  const mapCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center[0], center[1]])

  const onLoad = useCallback((map: google.maps.Map) => {
    map.setCenter({ lat: center[0], lng: center[1] })
    map.setZoom(zoom)
    map.setMapTypeId(mapType)
    setMap(map)
  }, [center, zoom, mapType])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  // Update map type when it changes
  useEffect(() => {
    if (map) {
      map.setMapTypeId(mapType)
    }
  }, [map, mapType])

  // Premium cinematic fly-to animation
  useEffect(() => {
    if (map && animateToCenter) {
      const currentCenter = map.getCenter()
      const currentZoom = map.getZoom() || 15

      if (!currentCenter) {
        map.setCenter({ lat: center[0], lng: center[1] })
        map.setZoom(zoom)
        return
      }

      const startLat = currentCenter.lat()
      const startLng = currentCenter.lng()
      const endLat = center[0]
      const endLng = center[1]
      const startZoom = currentZoom
      const endZoom = zoom

      // Calculate distance for duration scaling
      const latDiff = Math.abs(endLat - startLat)
      const lngDiff = Math.abs(endLng - startLng)
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

      // Premium easing function - cubic bezier approximation for smooth feel
      const easeInOutCubic = (t: number): number => {
        return t < 0.5
          ? 4 * t * t * t
          : 1 - Math.pow(-2 * t + 2, 3) / 2
      }

      // For longer distances, use a cinematic zoom-out-then-in effect
      const useFlyover = distance > 0.01 // ~1km
      const midZoom = useFlyover ? Math.min(startZoom, endZoom) - 2 : null

      // Dynamic duration based on distance (1.2s to 2.5s)
      const baseDuration = 1200
      const maxDuration = 2500
      const duration = Math.min(baseDuration + distance * 50000, maxDuration)

      let animationFrame: number
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const rawProgress = Math.min(elapsed / duration, 1)
        const progress = easeInOutCubic(rawProgress)

        // Interpolate position
        const lat = startLat + (endLat - startLat) * progress
        const lng = startLng + (endLng - startLng) * progress
        map.setCenter({ lat, lng })

        // For flyover effect: zoom out in first half, zoom in second half
        if (useFlyover && midZoom !== null) {
          let currentAnimZoom: number
          if (progress < 0.5) {
            // First half: ease out from start to mid
            const zoomProgress = progress * 2
            currentAnimZoom = startZoom + (midZoom - startZoom) * zoomProgress
          } else {
            // Second half: ease in from mid to end
            const zoomProgress = (progress - 0.5) * 2
            currentAnimZoom = midZoom + (endZoom - midZoom) * zoomProgress
          }
          map.setZoom(currentAnimZoom)
        } else {
          // Simple zoom interpolation
          const currentAnimZoom = startZoom + (endZoom - startZoom) * progress
          map.setZoom(currentAnimZoom)
        }

        if (rawProgress < 1) {
          animationFrame = requestAnimationFrame(animate)
        }
      }

      animationFrame = requestAnimationFrame(animate)

      return () => {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame)
        }
      }
    }
  }, [map, center, zoom, animateToCenter])

  // Manage ground overlays
  useEffect(() => {
    if (!map) return

    overlayRefs.current.forEach((overlay) => {
      overlay.setMap(null)
    })
    overlayRefs.current.clear()

    overlays.forEach(overlay => {
      const rotatableOverlay = new RotatableOverlay({
        imageUrl: overlay.imageUrl,
        bounds: overlay.bounds,
        rotation: overlay.rotation || 0,
        opacity: overlay.opacity,
        clickable: false
      })

      rotatableOverlay.setMap(map)
      overlayRefs.current.set(overlay.id, rotatableOverlay)
    })

    return () => {
      overlayRefs.current.forEach((overlay) => {
        overlay.setMap(null)
      })
      overlayRefs.current.clear()
    }
  }, [map, overlays])

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        .gm-style a[href^="https://maps.google.com/maps"],
        .gm-style .gmnoprint a,
        .gm-style .gm-style-cc,
        .gm-style .gm-bundled-control,
        .gm-style .gmnoprint,
        .gm-style .gm-fullscreen-control,
        .gm-style [class*="gm-control"],
        .gm-style .gm-svpc {
          display: none !important;
        }
      `}</style>
      <GoogleMap
        mapContainerStyle={{
          height: '100%',
          width: '100%'
        }}
        center={mapCenter}
        zoom={zoom}
        mapTypeId={mapType}
        options={{
          mapTypeId: mapType,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: false,
          scaleControl: false,
          rotateControl: false,
          panControl: false,
          tilt: 0,
          gestureHandling: 'greedy',
          disableDefaultUI: true
        }}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Spotlight effect - dark overlay with hole for highlighted area */}
        {highlight && highlight.coordinates && highlight.coordinates[0] && (
          <PolygonF
            paths={[
              // Outer bounds covering the world (clockwise)
              [
                { lat: -85, lng: -180 },
                { lat: 85, lng: -180 },
                { lat: 85, lng: 180 },
                { lat: -85, lng: 180 },
              ],
              // Inner hole - the spotlight area (counter-clockwise for hole)
              highlight.coordinates[0].map(coord => ({
                lat: coord[1],
                lng: coord[0]
              })).reverse()
            ]}
            options={{
              fillColor: '#000000',
              fillOpacity: 0.5,
              strokeColor: '#F59E0B',
              strokeWeight: 3,
              strokeOpacity: 1,
              clickable: false,
              zIndex: 5
            }}
          />
        )}
      </GoogleMap>
    </>
  )
}
