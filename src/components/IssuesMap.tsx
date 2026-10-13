'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, PolygonF, PolylineF, OverlayView } from '@react-google-maps/api'
import { ISSUE_CATEGORY_LABELS, type IssueCategory } from '@/lib/issues'
import { getPinIcon, getCategoryColor, PIN_COLORS } from '@/lib/map-pin-icons'
import { MapPinPopup } from '@/components/MapPinPopup'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ('drawing' | 'geometry' | 'visualization')[] = ['drawing', 'geometry', 'visualization']

const OPEN_COLOR = '#dc2626'
const RESOLVED_COLOR = '#16a34a'

export interface IssueMapPin {
  id: string
  latitude: number | null
  longitude: number | null
  shapeType: string
  geometry: unknown
  resolved: boolean
  comment: string
  category: string
  name: string | null
  createdAt: string
  photoUrl?: string | null
}

// GeoJSON positions ([lng, lat]) → Maps paths
function toPath(coords: unknown): google.maps.LatLngLiteral[] {
  if (!Array.isArray(coords)) return []
  return coords
    .filter((c): c is [number, number] => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number')
    .map(([lng, lat]) => ({ lat, lng }))
}

function shapePath(pin: IssueMapPin): google.maps.LatLngLiteral[] {
  const geometry = pin.geometry as { type?: string; coordinates?: unknown } | null
  if (!geometry?.coordinates) return []
  if (pin.shapeType === 'polygon') return toPath((geometry.coordinates as unknown[])[0])
  return toPath(geometry.coordinates)
}

export function IssuesMap({
  issues,
  onSelect,
  height = '420px',
}: {
  issues: IssueMapPin[]
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
  const [selected, setSelected] = useState<IssueMapPin | null>(null)

  // Close a popup whose pin has been filtered out from under it
  useEffect(() => {
    if (selected && !issues.some(p => p.id === selected.id)) setSelected(null)
  }, [issues, selected])

  // Where a shape's popup anchors (its first point)
  const anchorOf = (pin: IssueMapPin): google.maps.LatLngLiteral | null => {
    if (pin.latitude != null && pin.longitude != null) return { lat: pin.latitude, lng: pin.longitude }
    return shapePath(pin)[0] ?? null
  }

  const fitToIssues = useCallback((map: google.maps.Map) => {
    const bounds = new google.maps.LatLngBounds()
    let hasPoint = false
    for (const pin of issues) {
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
  }, [issues])

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    fitToIssues(map)
  }, [fitToIssues])

  // Refit when the plotted set changes (e.g. the open/resolved filter)
  useEffect(() => {
    if (mapRef.current) fitToIssues(mapRef.current)
  }, [fitToIssues])

  if (!isLoaded) {
    return (
      <div style={{ height }} className="flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const statusColor = (pin: IssueMapPin) => (pin.resolved ? RESOLVED_COLOR : OPEN_COLOR)
  const title = (pin: IssueMapPin) =>
    `${pin.resolved ? 'Resolved' : 'Open'} — ${pin.comment.length > 90 ? pin.comment.slice(0, 90) + '…' : pin.comment}`
  const categoryLabel = (c: string) => ISSUE_CATEGORY_LABELS[c as IssueCategory] || ISSUE_CATEGORY_LABELS.other

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height }}
      onLoad={onLoad}
      mapTypeId="hybrid"
      options={{
        streetViewControl: false,
        mapTypeControl: true,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      }}
    >
      {issues.map(pin => {
        if (pin.shapeType === 'polygon') {
          const path = shapePath(pin)
          if (!path.length) return null
          return (
            <PolygonF
              key={pin.id}
              paths={path}
              onClick={() => setSelected(pin)}
              options={{
                fillColor: getCategoryColor(pin.category, 0.3),
                strokeColor: getCategoryColor(pin.category, 1),
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
              options={{ strokeColor: getCategoryColor(pin.category, 1), strokeWeight: 3, clickable: true }}
            />
          )
        }
        if (pin.latitude == null || pin.longitude == null) return null
        return (
          <MarkerF
            key={pin.id}
            position={{ lat: pin.latitude, lng: pin.longitude }}
            title={title(pin)}
            onClick={() => setSelected(pin)}
            icon={getPinIcon(pin.category, false, pin.resolved)}
          />
        )
      })}

      {selected && anchorOf(selected) && (
        <OverlayView position={anchorOf(selected)!} mapPaneName={OverlayView.FLOAT_PANE}>
          <MapPinPopup
            pill={{ label: categoryLabel(selected.category).toUpperCase(), color: PIN_COLORS[selected.category] || PIN_COLORS.other }}
            statusPill={selected.resolved ? { label: 'RESOLVED', color: '#16a34a' } : { label: 'OPEN', color: '#d97706' }}
            comment={selected.comment}
            photoUrl={selected.photoUrl}
            meta={[selected.name, new Date(selected.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })]
              .filter(Boolean)
              .join(' · ')}
            actionLabel={onSelect ? 'View full report in list' : undefined}
            onAction={onSelect ? () => { setSelected(null); onSelect(selected.id) } : undefined}
            onClose={() => setSelected(null)}
          />
        </OverlayView>
      )}
    </GoogleMap>
  )
}
