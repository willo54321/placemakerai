'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry")[] = ['drawing', 'geometry']

interface Overlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
}

interface TourMapProps {
  center: [number, number]
  zoom: number
  overlays: Overlay[]
  mapType: 'roadmap' | 'satellite'
  animateToCenter?: boolean
}

export default function TourMap({
  center,
  zoom,
  overlays,
  mapType,
  animateToCenter = false
}: TourMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const overlayRefs = useRef<Map<string, google.maps.GroundOverlay>>(new Map())

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

  // Animate to new center/zoom when tour navigates
  useEffect(() => {
    if (map && animateToCenter) {
      map.panTo({ lat: center[0], lng: center[1] })
      const currentZoom = map.getZoom() || 15
      if (currentZoom !== zoom) {
        const zoomDiff = zoom - currentZoom
        const steps = Math.abs(zoomDiff) <= 2 ? 1 : 2
        const zoomStep = zoomDiff / steps
        let step = 0

        const zoomInterval = setInterval(() => {
          step++
          if (step >= steps) {
            map.setZoom(zoom)
            clearInterval(zoomInterval)
          } else {
            map.setZoom(currentZoom + zoomStep * step)
          }
        }, 200)
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
      const bounds = new google.maps.LatLngBounds(
        { lat: overlay.bounds[0][0], lng: overlay.bounds[0][1] },
        { lat: overlay.bounds[1][0], lng: overlay.bounds[1][1] }
      )

      const groundOverlay = new google.maps.GroundOverlay(
        overlay.imageUrl,
        bounds,
        { opacity: overlay.opacity, clickable: false }
      )

      groundOverlay.setMap(map)
      overlayRefs.current.set(overlay.id, groundOverlay)
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
      />
    </>
  )
}
