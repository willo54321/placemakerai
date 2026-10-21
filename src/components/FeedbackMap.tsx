'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, PolygonF, PolylineF, OverlayView } from '@react-google-maps/api'
import { getPinIcon, createPendingPinIcon, getCategoryColor, PIN_COLORS } from '@/lib/map-pin-icons'
import { MapPinPopup } from '@/components/MapPinPopup'
import { useImageOverlays, type MapImageOverlay } from '@/components/useImageOverlays'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ('drawing' | 'geometry' | 'visualization')[] = ['drawing', 'geometry', 'visualization']

// Same labels the embed popup shows
const CATEGORY_LABELS: Record<string, string> = {
  positive: 'POSITIVE',
  negative: 'NEGATIVE',
  question: 'IDEA/QUESTION',
  comment: 'COMMENT',
}

export interface FeedbackMapPin {
  id: string
  latitude: number | null
  longitude: number | null
  shapeType: string
  geometry: unknown
  category: string
  comment: string
  name: string | null
  createdAt: string
  approved: boolean
}

// GeoJSON positions ([lng, lat]) → Maps paths
function toPath(coords: unknown): google.maps.LatLngLiteral[] {
  if (!Array.isArray(coords)) return []
  return coords
    .filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(([lng, lat]) => ({ lat, lng }))
}

function shapePath(pin: FeedbackMapPin): google.maps.LatLngLiteral[] {
  const geometry = pin.geometry as { type?: string; coordinates?: unknown } | null
  if (!geometry?.coordinates) return []
  if (pin.shapeType === 'polygon') return toPath((geometry.coordinates as unknown[])[0])
  return toPath(geometry.coordinates)
}

export function FeedbackMap({
  pins,
  overlays = [],
  onSelect,
  height = '420px',
}: {
  pins: FeedbackMapPin[]
  overlays?: MapImageOverlay[]
  onSelect?: (pinId: string) => void
  height?: string
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed', // Same ID as all other maps to avoid conflicts
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    version: '3.64', // DrawingManager was removed from the Maps JS API in 3.65
    libraries: LIBRARIES,
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selected, setSelected] = useState<FeedbackMapPin | null>(null)

  // Overlays sit under the pins so responses read against the plan.
  useImageOverlays(map, overlays)

  useEffect(() => {
    if (selected && !pins.some(p => p.id === selected.id)) setSelected(null)
  }, [pins, selected])

  const anchorOf = (pin: FeedbackMapPin): google.maps.LatLngLiteral | null => {
    if (pin.latitude != null && pin.longitude != null) return { lat: pin.latitude, lng: pin.longitude }
    return shapePath(pin)[0] ?? null
  }

  const fitToPins = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    let hasPoint = false
    for (const pin of pins) {
      if (pin.latitude != null && pin.longitude != null) {
        bounds.extend({ lat: pin.latitude, lng: pin.longitude })
        hasPoint = true
      }
      for (const pt of shapePath(pin)) {
        bounds.extend(pt)
        hasPoint = true
      }
    }
    // No responses yet: frame the overlays instead.
    if (!hasPoint) {
      for (const o of overlays) {
        bounds.extend({ lat: o.bounds[0][0], lng: o.bounds[0][1] })
        bounds.extend({ lat: o.bounds[1][0], lng: o.bounds[1][1] })
        hasPoint = true
      }
    }
    if (!hasPoint) return
    map.fitBounds(bounds, 48)
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17)
    })
  }, [pins, overlays])

  const onLoad = useCallback((loaded: google.maps.Map) => {
    mapRef.current = loaded
    setMap(loaded)
    fitToPins(loaded)
  }, [fitToPins])

  useEffect(() => {
    if (mapRef.current) fitToPins(mapRef.current)
  }, [fitToPins])

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const color = (pin: FeedbackMapPin) => PIN_COLORS[pin.category] || PIN_COLORS.comment
  const label = (pin: FeedbackMapPin) => CATEGORY_LABELS[pin.category] || CATEGORY_LABELS.comment

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height }}
      onLoad={onLoad}
      options={{
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      }}
    >
      {pins.map(pin => {
        if (pin.shapeType === 'polygon') {
          const path = shapePath(pin)
          if (!path.length) return null
          return (
            <PolygonF
              key={pin.id}
              paths={path}
              onClick={() => setSelected(pin)}
              options={{
                fillColor: getCategoryColor(pin.category, pin.approved ? 0.3 : 0.15),
                strokeColor: getCategoryColor(pin.category, pin.approved ? 1 : 0.6),
                strokeWeight: 2,
                clickable: true,
              }}
            />
          )
        }
        if (pin.shapeType === 'line') {
          const path = shapePath(pin)
          if (!path.length) return null
          return (
            <PolylineF
              key={pin.id}
              path={path}
              onClick={() => setSelected(pin)}
              options={{ strokeColor: getCategoryColor(pin.category, pin.approved ? 1 : 0.6), strokeWeight: 3, clickable: true }}
            />
          )
        }
        if (pin.latitude == null || pin.longitude == null) return null
        return (
          <MarkerF
            key={pin.id}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            title={`${label(pin)}${pin.approved ? '' : ' (pending)'} — ${pin.comment.slice(0, 90)}`}
            onClick={() => setSelected(pin)}
            icon={pin.approved ? getPinIcon(pin.category) : createPendingPinIcon()}
          />
        )
      })}

      {selected && anchorOf(selected) && (
        <OverlayView position={anchorOf(selected)!} mapPaneName={OverlayView.FLOAT_PANE}>
          <MapPinPopup
            pill={{ label: label(selected), color: color(selected) }}
            statusPill={selected.approved ? { label: 'APPROVED', color: '#16a34a' } : { label: 'PENDING', color: '#8B5CF6' }}
            comment={selected.comment}
            meta={[selected.name, new Date(selected.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })]
              .filter(Boolean)
              .join(' · ')}
            actionLabel={onSelect ? 'View full response in list' : undefined}
            onAction={onSelect ? () => { setSelected(null); onSelect(selected.id) } : undefined}
            onClose={() => setSelected(null)}
          />
        </OverlayView>
      )}
    </GoogleMap>
  )
}
