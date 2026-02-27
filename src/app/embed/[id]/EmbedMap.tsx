'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, OverlayView, PolygonF, PolylineF, DrawingManagerF } from '@react-google-maps/api'
import { ThumbsUp, ThumbsDown, Lightbulb, MessageCircle, X } from 'lucide-react'
import { RotatableOverlay } from '@/components/RotatableOverlay'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry" | "places")[] = ['drawing', 'geometry']

interface GeoJSONGeometry {
  type: 'LineString' | 'Polygon'
  coordinates: number[][] | number[][][]
}

interface Overlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  rotation: number
}

interface PublicPin {
  id: string
  shapeType?: string
  latitude: number | null
  longitude: number | null
  geometry?: GeoJSONGeometry | null
  category: string
  comment: string
  name: string | null
  votes: number
  createdAt: string
}

type DrawMode = 'pin' | 'polygon' | null

interface EmbedMapProps {
  center: [number, number]
  zoom: number
  overlays: Overlay[]
  pins: PublicPin[]
  pendingPin: { lat: number; lng: number } | null
  pendingShape: { type: 'polygon'; geometry?: GeoJSONGeometry } | null
  drawMode: DrawMode
  isAddingPin: boolean
  onMapClick: (lat: number, lng: number) => void
  onShapeComplete: (geometry: GeoJSONGeometry, type: 'polygon') => void
  onVote: (pinId: string) => Promise<void>
  mapType: 'roadmap' | 'satellite'
  votedPins: Set<string>
  animateToCenter?: boolean
}

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  question: { color: '#F59E0B', bg: '#F59E0B', icon: Lightbulb, label: 'IDEA/QUESTION' },
  negative: { color: '#EF4444', bg: '#EF4444', icon: ThumbsDown, label: 'NEGATIVE' },
  positive: { color: '#10B981', bg: '#10B981', icon: ThumbsUp, label: 'POSITIVE' },
  comment: { color: '#6366F1', bg: '#6366F1', icon: MessageCircle, label: 'COMMENT' },
}

// SVG icons for each category (centered at 24, 22)
const CATEGORY_ICONS: Record<string, string> = {
  question: `
    <circle cx="24" cy="14" r="2.5" fill="#F59E0B"/>
    <rect x="21.5" y="18" width="5" height="11" rx="2" fill="#F59E0B"/>
  `,
  negative: `
    <path d="M18 16L30 28M30 16L18 28" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>
  `,
  positive: `
    <path d="M15 22L21 28L33 16" stroke="#10B981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `,
  comment: `
    <circle cx="17" cy="22" r="2.5" fill="#6366F1"/>
    <circle cx="24" cy="22" r="2.5" fill="#6366F1"/>
    <circle cx="31" cy="22" r="2.5" fill="#6366F1"/>
  `,
}

function createPinIcon(category: string, isHovered: boolean = false): google.maps.Icon {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.question
  const iconSvg = CATEGORY_ICONS[category] || CATEGORY_ICONS.question

  const shadowBlur = isHovered ? '3' : '2'
  const shadowOpacity = isHovered ? '0.3' : '0.25'

  const svg = `
    <svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill="${config.color}"/>
        <circle cx="24" cy="22" r="14" fill="white"/>
        ${iconSvg}
      </g>
    </svg>
  `

  const size = isHovered ? 48 : 44
  const height = isHovered ? 58 : 53

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height)
  }
}

function createPendingPinIcon(): google.maps.Icon {
  const svg = `
    <svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pendingShadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#7C3AED" flood-opacity="0.4"/>
        </filter>
      </defs>
      <g filter="url(#pendingShadow)">
        <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill="#8B5CF6" stroke="white" stroke-width="2" stroke-dasharray="5 3"/>
        <circle cx="24" cy="22" r="10" fill="white"/>
        <circle cx="24" cy="22" r="5" fill="#8B5CF6"/>
      </g>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(44, 53),
    anchor: new google.maps.Point(22, 53)
  }
}

// Get category color with opacity for shapes
function getCategoryColor(category: string, opacity: number = 1): string {
  const colors: Record<string, string> = {
    question: `rgba(245, 158, 11, ${opacity})`,
    negative: `rgba(239, 68, 68, ${opacity})`,
    positive: `rgba(16, 185, 129, ${opacity})`,
    comment: `rgba(99, 102, 241, ${opacity})`,
  }
  return colors[category] || colors.comment
}

// Calculate centroid for shapes (for popup positioning)
function getShapeCentroid(geometry: GeoJSONGeometry): { lat: number; lng: number } {
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates as number[][]
    const midIndex = Math.floor(coords.length / 2)
    return { lat: coords[midIndex][1], lng: coords[midIndex][0] }
  } else if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0] as number[][]
    let latSum = 0, lngSum = 0
    coords.forEach(coord => {
      lngSum += coord[0]
      latSum += coord[1]
    })
    return { lat: latSum / coords.length, lng: lngSum / coords.length }
  }
  return { lat: 0, lng: 0 }
}

export default function EmbedMap({
  center,
  zoom,
  overlays,
  pins,
  pendingPin,
  pendingShape,
  drawMode,
  isAddingPin,
  onMapClick,
  onShapeComplete,
  onVote,
  mapType,
  votedPins,
  animateToCenter = false
}: EmbedMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [closingPin, setClosingPin] = useState<string | null>(null)
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null)

  const closePopup = useCallback(() => {
    if (selectedPin) {
      setClosingPin(selectedPin)
      setTimeout(() => {
        setSelectedPin(null)
        setClosingPin(null)
      }, 200)
    }
  }, [selectedPin])

  const overlayRefs = useRef<Map<string, RotatableOverlay>>(new Map())

  const mapCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center[0], center[1]])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && drawMode === 'pin') {
      onMapClick(e.latLng.lat(), e.latLng.lng())
    }
    closePopup()
  }, [drawMode, onMapClick, closePopup])

  // Handle polygon complete
  const handlePolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    const path = polygon.getPath()
    const coordinates: number[][] = []

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      coordinates.push([point.lng(), point.lat()])
    }
    // Close the polygon
    if (coordinates.length > 0) {
      coordinates.push(coordinates[0])
    }

    // Remove the drawn shape (we'll show it as pending)
    polygon.setMap(null)

    if (coordinates.length >= 4) { // At least 3 points + closing point
      onShapeComplete({
        type: 'Polygon',
        coordinates: [coordinates]
      }, 'polygon')
    }
  }, [onShapeComplete])

  const mapTypeRef = useRef(mapType)
  mapTypeRef.current = mapType

  const onLoad = useCallback((map: google.maps.Map) => {
    map.setMapTypeId(mapTypeRef.current)
    setMap(map)
  }, [])

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

  // Manage ground overlays - only update what changed, don't recreate all
  useEffect(() => {
    if (!map) return

    // Create a set of current overlay IDs
    const currentOverlayIds = new Set(overlays.map(o => o.id))

    // Remove overlays that no longer exist
    overlayRefs.current.forEach((overlay, id) => {
      if (!currentOverlayIds.has(id)) {
        overlay.setMap(null)
        overlayRefs.current.delete(id)
      }
    })

    // Add or update overlays
    overlays.forEach(overlay => {
      const existingOverlay = overlayRefs.current.get(overlay.id)

      if (existingOverlay) {
        // Update opacity if changed
        if (existingOverlay.getOpacity() !== overlay.opacity) {
          existingOverlay.setOpacity(overlay.opacity)
        }
        // Update rotation if changed
        if (existingOverlay.getRotation() !== (overlay.rotation || 0)) {
          existingOverlay.setRotation(overlay.rotation || 0)
        }
      } else {
        // Create new overlay using RotatableOverlay
        const rotatableOverlay = new RotatableOverlay({
          imageUrl: overlay.imageUrl,
          bounds: overlay.bounds,
          rotation: overlay.rotation || 0,
          opacity: overlay.opacity,
          clickable: false
        })

        rotatableOverlay.setMap(map)
        overlayRefs.current.set(overlay.id, rotatableOverlay)
      }
    })

    return () => {
      overlayRefs.current.forEach((overlay) => {
        overlay.setMap(null)
      })
      overlayRefs.current.clear()
    }
  }, [map, JSON.stringify(overlays.map(o => ({ id: o.id, opacity: o.opacity, rotation: o.rotation })))])

  // Update drawing manager mode when drawMode changes
  useEffect(() => {
    if (drawingManagerRef.current) {
      if (drawMode === 'polygon') {
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON)
      } else {
        drawingManagerRef.current.setDrawingMode(null)
      }
    }
  }, [drawMode])

  // Memoize map options - keep stable, mapType is controlled via useEffect
  const mapOptions = useMemo(() => ({
    mapTypeControl: false,
    mapTypeControlOptions: {
      mapTypeIds: [] // Empty array to fully disable
    },
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: false,
    scaleControl: false,
    rotateControl: false,
    panControl: false,
    tilt: 0,
    gestureHandling: 'greedy',
    disableDefaultUI: true,
    draggable: true,
    scrollwheel: true,
    draggableCursor: 'grab',
    draggingCursor: 'grabbing',
    maxZoom: 18
  }), [])

  // Drawing manager options - always available
  const drawingManagerOptions = useMemo(() => ({
    drawingMode: null as google.maps.drawing.OverlayType | null,
    drawingControl: false,
    polygonOptions: {
      fillColor: '#8B5CF6',
      fillOpacity: 0.3,
      strokeColor: '#8B5CF6',
      strokeWeight: 3,
      strokeOpacity: 0.8,
      editable: false,
      clickable: false,
    }
  }), [])

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

  // Separate pins by shape type
  const pointPins = pins.filter(p => (!p.shapeType || p.shapeType === 'pin') && p.latitude && p.longitude)
  const linePins = pins.filter(p => p.shapeType === 'line' && p.geometry)
  const polygonPins = pins.filter(p => p.shapeType === 'polygon' && p.geometry)

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes popupSlideIn {
          0% { opacity: 0; transform: translate(-50%, calc(-100% - 50px)) scale(0.95); }
          100% { opacity: 1; transform: translate(-50%, calc(-100% - 60px)) scale(1); }
        }
        .animate-popup { animation: popupSlideIn 0.25s ease-out forwards; }
        @keyframes popupSlideOut {
          0% { opacity: 1; transform: translate(-50%, calc(-100% - 60px)) scale(1); }
          100% { opacity: 0; transform: translate(-50%, calc(-100% - 50px)) scale(0.95); }
        }
        .animate-popup-out { animation: popupSlideOut 0.2s ease-in forwards; }
        .gm-style a[href^="https://maps.google.com/maps"],
        .gm-style .gmnoprint a,
        .gm-style .gm-style-cc,
        .gm-style .gm-bundled-control,
        .gm-style .gmnoprint,
        .gm-style .gm-fullscreen-control,
        .gm-style [class*="gm-control"],
        .gm-style .gm-svpc,
        .gm-style .gm-style-mtc,
        .gm-style [aria-label="Map Type"],
        .gm-style [aria-label="Show street map"],
        .gm-style [aria-label="Show satellite imagery"],
        .gm-style button[title="Change map style"] {
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
        options={mapOptions}
        onClick={handleMapClick}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        {/* Drawing Manager for polygons */}
        <DrawingManagerF
          onLoad={(dm) => {
            drawingManagerRef.current = dm
            // Set initial mode if drawMode is already polygon
            if (drawMode === 'polygon') {
              dm.setDrawingMode(google.maps.drawing.OverlayType.POLYGON)
            }
          }}
          options={drawingManagerOptions}
          onPolygonComplete={handlePolygonComplete}
        />

        {/* Existing Polygon Pins */}
        {polygonPins.map(pin => {
          const geometry = pin.geometry as GeoJSONGeometry
          const coords = (geometry.coordinates[0] as number[][]).map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))
          const isSelected = selectedPin === pin.id
          return (
            <PolygonF
              key={pin.id}
              paths={coords}
              options={{
                fillColor: getCategoryColor(pin.category, isSelected ? 0.5 : 0.3),
                fillOpacity: 1,
                strokeColor: getCategoryColor(pin.category, 1),
                strokeWeight: isSelected ? 4 : 3,
                strokeOpacity: 1,
                clickable: true,
                zIndex: isSelected ? 10 : 1
              }}
              onClick={() => setSelectedPin(pin.id)}
              onMouseOver={() => setHoveredPin(pin.id)}
              onMouseOut={() => setHoveredPin(null)}
            />
          )
        })}

        {/* Existing Line Pins */}
        {linePins.map(pin => {
          const geometry = pin.geometry as GeoJSONGeometry
          const coords = (geometry.coordinates as number[][]).map(coord => ({
            lat: coord[1],
            lng: coord[0]
          }))
          const isSelected = selectedPin === pin.id
          return (
            <PolylineF
              key={pin.id}
              path={coords}
              options={{
                strokeColor: getCategoryColor(pin.category, 1),
                strokeWeight: isSelected ? 6 : 4,
                strokeOpacity: isSelected ? 1 : 0.8,
                clickable: true,
                zIndex: isSelected ? 10 : 1
              }}
              onClick={() => setSelectedPin(pin.id)}
              onMouseOver={() => setHoveredPin(pin.id)}
              onMouseOut={() => setHoveredPin(null)}
            />
          )
        })}

        {/* Pending Shape Preview */}
        {pendingShape?.geometry && pendingShape.type === 'polygon' && (
          <PolygonF
            paths={(pendingShape.geometry.coordinates[0] as number[][]).map(coord => ({
              lat: coord[1],
              lng: coord[0]
            }))}
            options={{
              fillColor: '#8B5CF6',
              fillOpacity: 0.3,
              strokeColor: '#8B5CF6',
              strokeWeight: 3,
              strokeOpacity: 0.8,
            }}
          />
        )}

        {/* Existing Point Pins */}
        {pointPins.map(pin => (
          <MarkerF
            key={pin.id}
            position={{ lat: pin.latitude!, lng: pin.longitude! }}
            icon={createPinIcon(pin.category, hoveredPin === pin.id)}
            onClick={() => {
              if (selectedPin === pin.id) {
                closePopup()
              } else {
                setSelectedPin(pin.id)
              }
            }}
            onMouseOver={() => setHoveredPin(pin.id)}
            onMouseOut={() => setHoveredPin(null)}
            cursor="pointer"
          />
        ))}

        {/* Pending Pin */}
        {pendingPin && (
          <MarkerF
            position={{ lat: pendingPin.lat, lng: pendingPin.lng }}
            icon={createPendingPinIcon()}
            animation={google.maps.Animation.BOUNCE}
          />
        )}

        {/* Selected Pin Custom Popup */}
        {selectedPin && (() => {
          const pin = pins.find(p => p.id === selectedPin)
          if (!pin) return null

          const config = CATEGORY_CONFIG[pin.category] || CATEGORY_CONFIG.question

          // Get position based on shape type
          let position: { lat: number; lng: number }
          if ((!pin.shapeType || pin.shapeType === 'pin') && pin.latitude && pin.longitude) {
            position = { lat: pin.latitude, lng: pin.longitude }
          } else if (pin.geometry) {
            position = getShapeCentroid(pin.geometry)
          } else {
            return null
          }

          // Get shape type label
          const shapeLabel = pin.shapeType === 'line' ? 'ROUTE' : pin.shapeType === 'polygon' ? 'AREA' : ''

          const sentences = pin.comment.split(/(?<=[.!?])\s+/)
          const title = sentences[0] || pin.comment
          const description = sentences.length > 1 ? sentences.slice(1).join(' ') : ''
          const truncatedDesc = description.length > 120 ? description.slice(0, 120) + '...' : description

          return (
            <OverlayView
              position={position}
              mapPaneName={OverlayView.FLOAT_PANE}
            >
              <div
                className={`bg-white rounded-xl shadow-2xl p-4 relative ${closingPin === pin.id ? 'animate-popup-out' : 'animate-popup'}`}
                style={{ width: '320px', fontFamily: "'DM Sans', sans-serif" }}
              >
                <button
                  onClick={closePopup}
                  className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors z-10"
                >
                  <X size={16} className="text-gray-500" />
                </button>

                <div className="flex items-start justify-between gap-3 mb-2 pr-8">
                  <h3 className="text-base font-semibold text-gray-900 leading-tight flex-1">
                    {title}
                  </h3>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className="text-xs font-bold text-white px-3 py-1 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: config.bg }}
                    >
                      {config.label}
                    </span>
                    {shapeLabel && (
                      <span className="text-xs font-medium text-brand-600 bg-brand-100 px-2 py-0.5 rounded">
                        {shapeLabel}
                      </span>
                    )}
                  </div>
                </div>

                {truncatedDesc && (
                  <p className="text-sm text-gray-500 leading-relaxed mb-3">
                    {truncatedDesc}
                  </p>
                )}

                {votedPins.has(pin.id) ? (
                  <div className="w-full flex items-center justify-center py-2 mb-3 border border-green-200 bg-green-50 rounded-lg">
                    <ThumbsUp size={18} className="text-green-500 mr-2" fill="currentColor" />
                    <span className="text-green-700 font-medium mr-1">{pin.votes}</span>
                    <span className="text-green-600">Voted</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onVote(pin.id)
                    }}
                    className="w-full flex items-center justify-center py-2 mb-3 border border-gray-200 rounded-lg hover:bg-brand-50 hover:border-brand-300 transition-colors cursor-pointer"
                  >
                    <ThumbsUp size={18} className="text-brand-500 mr-2" />
                    <span className="text-gray-700 font-medium mr-1">{pin.votes}</span>
                    <span className="text-gray-500">Vote{pin.votes !== 1 ? 's' : ''}</span>
                  </button>
                )}

                <p className="text-sm text-gray-400">
                  {new Date(pin.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </OverlayView>
          )
        })()}
      </GoogleMap>
    </>
  )
}
