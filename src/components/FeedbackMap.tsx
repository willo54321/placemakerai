'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, PolygonF, PolylineF, InfoWindowF } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ('drawing' | 'geometry' | 'visualization')[] = ['drawing', 'geometry', 'visualization']

// Matches CATEGORY_CONFIG in the responses list
const CATEGORY_COLORS: Record<string, string> = {
  positive: '#16a34a',
  negative: '#dc2626',
  question: '#2563eb',
  comment: '#6b7280',
}
const CATEGORY_LABELS: Record<string, string> = {
  positive: 'Positive',
  negative: 'Concern',
  question: 'Question',
  comment: 'Comment',
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
  onSelect,
  height = '420px',
}: {
  pins: FeedbackMapPin[]
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
  const [selected, setSelected] = useState<FeedbackMapPin | null>(null)

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
    if (!hasPoint) return
    map.fitBounds(bounds, 48)
    google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 17) map.setZoom(17)
    })
  }, [pins])

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    fitToPins(map)
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

  const color = (pin: FeedbackMapPin) => CATEGORY_COLORS[pin.category] || CATEGORY_COLORS.comment
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
                fillColor: color(pin),
                fillOpacity: pin.approved ? 0.25 : 0.12,
                strokeColor: color(pin),
                strokeOpacity: pin.approved ? 1 : 0.5,
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
              options={{ strokeColor: color(pin), strokeOpacity: pin.approved ? 1 : 0.5, strokeWeight: 3, clickable: true }}
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
            opacity={pin.approved ? 1 : 0.55}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: color(pin),
              fillOpacity: 1,
              strokeColor: pin.approved ? '#ffffff' : '#f59e0b',
              strokeWeight: 2,
            }}
          />
        )
      })}

      {selected && anchorOf(selected) && (
        <InfoWindowF position={anchorOf(selected)!} onCloseClick={() => setSelected(null)}>
          <div className="max-w-[280px] text-sm">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: color(selected) }}
              >
                {label(selected)}
              </span>
              <span className={`text-xs font-medium ${selected.approved ? 'text-green-700' : 'text-amber-600'}`}>
                {selected.approved ? 'Approved' : 'Pending approval'}
              </span>
            </div>
            <p className="text-slate-800 whitespace-pre-wrap">
              {selected.comment.length > 220 ? selected.comment.slice(0, 220) + '…' : selected.comment}
            </p>
            <div className="mt-1.5 text-xs text-slate-500">
              {[selected.name, new Date(selected.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {onSelect && (
              <button
                onClick={() => { setSelected(null); onSelect(selected.id) }}
                className="mt-2 text-xs font-medium text-green-700 hover:underline"
              >
                View full response in list
              </button>
            )}
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>
  )
}
