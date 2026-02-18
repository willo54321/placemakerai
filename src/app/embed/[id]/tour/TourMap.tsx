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
