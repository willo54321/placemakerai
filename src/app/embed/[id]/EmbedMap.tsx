'use client'

import { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, OverlayView, PolygonF, PolylineF, DrawingManagerF } from '@react-google-maps/api'
import { ThumbsUp, ThumbsDown, Lightbulb, MessageCircle, X, AlertTriangle } from 'lucide-react'
import { RotatableOverlay } from '@/components/RotatableOverlay'
import { OverlayStack, footprintKey } from '@/components/OverlayStack'
import { startFlyTo } from '@/lib/fly-to'
import { getPinIcon, createPendingPinIcon, getCategoryColor, tourStopPinUrl, planLayerIcon } from '@/lib/map-pin-icons'
import { TOUR_STOP_ICON_PATHS } from '@/lib/tour-icons'

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
  votes: number
  createdAt: string
  // Construction-issue reports only
  photoUrl?: string | null
  resolved?: boolean
  resolvedNotes?: string | null
}

type DrawMode = 'pin' | 'polygon' | null

interface Zone {
  id: string
  name: string
  status: string
  blurb: string
  color: string
  strokeColor?: string | null
  geometry: GeoJSONGeometry | null
  /** Every feature's geometry (polygons, lines or points); falls back to `geometry`. */
  geometries?: GeoJSONGeometry[]
  fillOpacity?: number | null
  strokeWidth?: number | null
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  kind?: 'polygon' | 'line' | 'point'
  /** Shared marker glyph id (TOUR_STOP_ICON_PATHS). */
  icon?: string | null
}

interface HighlightGeometry {
  type: 'Polygon'
  coordinates: number[][][]
}

interface TourStopMarker {
  id: string
  latitude: number
  longitude: number
  title: string
  icon?: string | null
}

interface EmbedMapProps {
  center: [number, number]
  zoom: number
  overlays: Overlay[]
  pins: PublicPin[]
  zones?: Zone[]
  pendingPin: { lat: number; lng: number } | null
  pendingShape: { type: 'polygon'; geometry?: GeoJSONGeometry } | null
  drawMode: DrawMode
  isAddingPin: boolean
  onMapClick: (lat: number, lng: number) => void
  onShapeComplete: (geometry: GeoJSONGeometry, type: 'polygon') => void
  onVote: (pinId: string) => Promise<void>
  mapType: 'roadmap' | 'satellite'
  votedPins: Set<string>
  // Guided tour: animated camera target, dimmed-outside spotlight, numbered
  // stop markers. tourCamera drives the cinematic fly-to; `center`/`zoom`
  // must stay constant while it is set (see the fly-to effect).
  tourCamera?: { lat: number; lng: number; zoom: number } | null
  highlight?: HighlightGeometry | null
  tourStops?: TourStopMarker[]
  activeTourStopIndex?: number | null
  onTourStopClick?: (index: number) => void
  // Styling options
  hideStreetLabels?: boolean
  primaryColor?: string
  // Issue-reporter embed: changes popup copy only (icons key off category ids)
  issuesMode?: boolean
}

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  question: { color: '#F59E0B', bg: '#F59E0B', icon: Lightbulb, label: 'IDEA/QUESTION' },
  negative: { color: '#EF4444', bg: '#EF4444', icon: ThumbsDown, label: 'NEGATIVE' },
  positive: { color: '#10B981', bg: '#10B981', icon: ThumbsUp, label: 'POSITIVE' },
  comment: { color: '#6366F1', bg: '#6366F1', icon: MessageCircle, label: 'COMMENT' },
  // Construction-issue categories (issue-reporter embed) — ids don't collide
  // with the feedback ids, so both modes share one config.
  noise: { color: '#EF4444', bg: '#EF4444', icon: AlertTriangle, label: 'NOISE' },
  dust: { color: '#F59E0B', bg: '#F59E0B', icon: AlertTriangle, label: 'DUST/POLLUTION' },
  traffic: { color: '#8B5CF6', bg: '#8B5CF6', icon: AlertTriangle, label: 'TRAFFIC/ACCESS' },
  damage: { color: '#DC2626', bg: '#DC2626', icon: AlertTriangle, label: 'PROPERTY DAMAGE' },
  safety: { color: '#EF4444', bg: '#EF4444', icon: AlertTriangle, label: 'SAFETY' },
  hours: { color: '#6366F1', bg: '#6366F1', icon: AlertTriangle, label: 'WORKING HOURS' },
  other: { color: '#6B7280', bg: '#6B7280', icon: AlertTriangle, label: 'OTHER' },
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

// Plan lines shorter than this get no glyph badge (short connectors would clutter).
const BADGE_MIN_LINE_M = 400

// Point half-way along a [lng, lat] line by distance, or null if the line is
// shorter than minLength metres. Equirectangular distances — fine at site scale.
function lineMidpoint(line: number[][], minLength: number): { lat: number; lng: number } | null {
  const seg = (a: number[], b: number[]) => {
    const k = Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180)
    return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * 111320
  }
  const lengths = line.slice(1).map((p, i) => seg(line[i], p))
  const total = lengths.reduce((s, l) => s + l, 0)
  if (total < minLength) return null
  let remaining = total / 2
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] ? remaining / lengths[i] : 0
      const [a, b] = [line[i], line[i + 1]]
      return { lat: a[1] + (b[1] - a[1]) * t, lng: a[0] + (b[0] - a[0]) * t }
    }
    remaining -= lengths[i]
  }
  return null
}

export interface EmbedMapHandle {
  getMapInstance: () => google.maps.Map | null
}

const EmbedMap = forwardRef<EmbedMapHandle, EmbedMapProps>(function EmbedMap({
  center,
  zoom,
  overlays,
  pins,
  zones = [],
  pendingPin,
  pendingShape,
  drawMode,
  isAddingPin,
  onMapClick,
  onShapeComplete,
  onVote,
  mapType,
  votedPins,
  tourCamera = null,
  highlight = null,
  tourStops = [],
  activeTourStopIndex = null,
  onTourStopClick,
  hideStreetLabels = false,
  primaryColor,
  issuesMode = false
}, ref) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    version: '3.64', // DrawingManager was removed from the Maps JS API in 3.65
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPin, setSelectedPin] = useState<string | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [closingPin, setClosingPin] = useState<string | null>(null)
  const [hoveredPin, setHoveredPin] = useState<string | null>(null)
  const [showFullComment, setShowFullComment] = useState(false)
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null)

  // Expose map instance via ref
  useImperativeHandle(ref, () => ({
    getMapInstance: () => map
  }), [map])

  const closePopup = useCallback(() => {
    if (selectedPin) {
      setClosingPin(selectedPin)
      setTimeout(() => {
        setSelectedPin(null)
        setClosingPin(null)
      }, 200)
    }
  }, [selectedPin])

  // Select a pin: reset the read-more toggle and pan the map so the
  // popup (which floats above the point) is brought fully into view.
  const selectPin = useCallback((pinId: string, position: { lat: number; lng: number }) => {
    setShowFullComment(false)
    setSelectedPin(pinId)
    if (map) {
      map.panTo(position)
      // The popup renders above the anchor point, so shift the map down a
      // little afterwards so the popup body isn't clipped by the top edge.
      window.setTimeout(() => {
        map.panBy(0, -140)
      }, 60)
    }
  }, [map])

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

  // Cinematic fly-to. Kept OFF the `center`/`zoom` props on purpose:
  // react-google-maps applies changed `center` props with an instant
  // map.setCenter() in a child effect that runs *before* ours, which would
  // snap to the target and reduce the animation to a no-op. Camera moves that
  // should animate go through the `tourCamera` prop instead, while `center`
  // stays constant.
  useEffect(() => {
    if (!map || !tourCamera) return
    return startFlyTo(map, tourCamera)
  }, [map, tourCamera])

  // Ground overlays. Layers sharing one footprint (a plan imported layer by
  // layer) are stacked into a single canvas overlay, so the map moves one
  // texture per frame however many layers are on; a layer toggle redraws the
  // canvas. Overlays with their own footprint are drawn individually.
  const stacksRef = useRef<Map<string, OverlayStack>>(new Map())
  useEffect(() => {
    if (!map) return

    const groups = new Map<string, Overlay[]>()
    for (const overlay of overlays) {
      const key = footprintKey(overlay)
      const group = groups.get(key)
      if (group) group.push(overlay)
      else groups.set(key, [overlay])
    }
    const wanted = new Map<string, Overlay[]>()
    groups.forEach((members, key) => wanted.set(members.length > 1 ? `stack:${key}` : members[0].id, members))

    // Remove what's gone
    overlayRefs.current.forEach((drawn, id) => {
      if (!wanted.has(id)) {
        drawn.setMap(null)
        overlayRefs.current.delete(id)
        stacksRef.current.get(id)?.dispose()
        stacksRef.current.delete(id)
      }
    })

    wanted.forEach((members, id) => {
      const first = members[0]
      const stacked = members.length > 1
      const existing = overlayRefs.current.get(id)
      if (existing) {
        if (stacked) {
          stacksRef.current.get(id)?.setLayers(members.map(m => ({ id: m.id, imageUrl: m.imageUrl, opacity: m.opacity })))
        } else if (existing.getOpacity() !== first.opacity) {
          existing.setOpacity(first.opacity)
        }
        if (existing.getRotation() !== (first.rotation || 0)) existing.setRotation(first.rotation || 0)
        return
      }
      let stack: OverlayStack | undefined
      if (stacked) {
        stack = new OverlayStack()
        stack.setLayers(members.map(m => ({ id: m.id, imageUrl: m.imageUrl, opacity: m.opacity })))
        stacksRef.current.set(id, stack)
      }
      const drawn = new RotatableOverlay({
        imageUrl: first.imageUrl,
        canvas: stack?.canvas,
        bounds: first.bounds,
        rotation: first.rotation || 0,
        // Per-layer opacity is applied inside the stack's canvas
        opacity: stacked ? 1 : first.opacity,
        clickable: false,
      })
      drawn.setMap(map)
      overlayRefs.current.set(id, drawn)
    })

    return () => {
      overlayRefs.current.forEach(drawn => drawn.setMap(null))
      overlayRefs.current.clear()
      stacksRef.current.forEach(stack => stack.dispose())
      stacksRef.current.clear()
    }
  }, [map, JSON.stringify(overlays.map(o => ({ id: o.id, url: o.imageUrl, opacity: o.opacity, rotation: o.rotation, bounds: o.bounds })))])

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

  // Map styles to hide street labels
  const hideLabelsStyles: google.maps.MapTypeStyle[] = [
    {
      featureType: 'all',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'administrative',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'road',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    },
    {
      featureType: 'water',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]

  // Memoize map options - keep stable, mapType is controlled via useEffect
  const mapOptions = useMemo(() => ({
    mapTypeControl: false,
    mapTypeControlOptions: {
      mapTypeIds: [] // Empty array to fully disable
    },
    streetViewControl: false,
    fullscreenControl: false,
    // Visible zoom buttons: needed for touch users and keyboard accessibility
    zoomControl: true,
    // Don't let Google's business/POI icons steal clicks aimed at feedback pins
    clickableIcons: false,
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
    maxZoom: 18,
    // Raster maps round zoom to whole levels by default, which makes the
    // tour fly-to's interpolated zoom step visibly. Fractional zoom renders
    // the in-between levels so the animation is actually smooth.
    isFractionalZoomEnabled: true,
    styles: hideStreetLabels ? hideLabelsStyles : undefined
  }), [hideStreetLabels])

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

  // Separate pins by shape type (memoized so we don't re-filter every render)
  const pointPins = useMemo(
    () => pins.filter(p => (!p.shapeType || p.shapeType === 'pin') && p.latitude && p.longitude),
    [pins]
  )
  const linePins = useMemo(
    () => pins.filter(p => p.shapeType === 'line' && p.geometry),
    [pins]
  )
  const polygonPins = useMemo(
    () => pins.filter(p => p.shapeType === 'polygon' && p.geometry),
    [pins]
  )

  // Pre-compute polygon path conversions (GeoJSON [lng,lat] -> {lat,lng})
  const polygonPaths = useMemo(() => {
    const paths = new globalThis.Map<string, { lat: number; lng: number }[]>()
    polygonPins.forEach(pin => {
      const geometry = pin.geometry as GeoJSONGeometry
      paths.set(pin.id, (geometry.coordinates[0] as number[][]).map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })))
    })
    return paths
  }, [polygonPins])

  const linePaths = useMemo(() => {
    const paths = new globalThis.Map<string, { lat: number; lng: number }[]>()
    linePins.forEach(pin => {
      const geometry = pin.geometry as GeoJSONGeometry
      paths.set(pin.id, (geometry.coordinates as number[][]).map(coord => ({
        lat: coord[1],
        lng: coord[0]
      })))
    })
    return paths
  }, [linePins])

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100 p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={28} className="text-red-500" />
          </div>
          <p className="text-gray-700 font-medium mb-1">The map could not be loaded</p>
          <p className="text-gray-500 text-sm">Please refresh the page. If the problem persists, try again later.</p>
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading map...</div>
      </div>
    )
  }

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
        .gm-style .gm-style-cc,
        .gm-style .gm-fullscreen-control,
        .gm-style .gm-svpc,
        .gm-style .gm-style-mtc,
        .gm-style [aria-label="Map Type"],
        .gm-style [aria-label="Show street map"],
        .gm-style [aria-label="Show satellite imagery"],
        .gm-style button[title="Change map style"] {
          display: none !important;
        }
        /* Note: .gm-bundled-control / [class*="gm-control"] / bare .gmnoprint
           must NOT be hidden — that's the zoom control (accessibility). */
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

        {/* Tour spotlight — dark overlay with a hole over the highlighted area */}
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
              fillOpacity: 0.45,
              strokeColor: primaryColor || '#F59E0B',
              strokeWeight: 3,
              strokeOpacity: 1,
              clickable: false,
              zIndex: 5
            }}
          />
        )}

        {/* Tour stop markers — the feedback pin shape in the project colour, clickable to jump to a stop */}
        {tourStops.map((stop, index) => {
          const active = activeTourStopIndex === index
          const width = active ? 52 : 44
          return (
            <OverlayView
              key={`tour-stop-${stop.id}`}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <button
                onClick={() => onTourStopClick?.(index)}
                aria-label={`Tour stop ${index + 1}: ${stop.title}`}
                style={{ transform: 'translate(-50%, -100%)', width, zIndex: active ? 30 : 20 }}
                className="relative block cursor-pointer transition-all duration-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tourStopPinUrl(primaryColor || '#10B981', stop.icon && TOUR_STOP_ICON_PATHS[stop.icon] ? { iconPath: TOUR_STOP_ICON_PATHS[stop.icon] } : { number: index + 1 })}
                  alt=""
                  draggable={false}
                  className="block w-full h-auto select-none"
                />
              </button>
            </OverlayView>
          )
        })}

        {/* Plot zones — client-drawn boundaries and plan layers, underneath feedback */}
        {zones.flatMap(zone => {
          const isSelected = selectedZone === zone.id
          const geoms = (zone.geometries && zone.geometries.length > 0 ? zone.geometries : zone.geometry ? [zone.geometry] : []) as any[]
          const baseFill = zone.fillOpacity ?? 0.16
          const fillOpacity = isSelected ? Math.min(1, baseFill + 0.12) : baseFill
          const strokeWeight = (zone.strokeWidth ?? 2) + (isSelected ? 1 : 0)
          const select = () => { setSelectedPin(null); setSelectedZone(zone.id) }
          const toPath = (ring: number[][]) => ring.map(([lng, lat]) => ({ lat, lng }))
          const stroke = zone.strokeColor || zone.color
          const glyph = zone.icon ? TOUR_STOP_ICON_PATHS[zone.icon] : undefined
          // Dashed / dotted lines: Google draws the stroke invisible and repeats a symbol along it.
          const lineOptions = zone.lineStyle && zone.lineStyle !== 'solid'
            ? {
                strokeOpacity: 0,
                icons: [{
                  icon: zone.lineStyle === 'dotted'
                    ? { path: google.maps.SymbolPath.CIRCLE, scale: strokeWeight * 0.9, fillColor: stroke, fillOpacity: 1, strokeOpacity: 0 }
                    : { path: 'M 0,-1 0,1', strokeColor: stroke, strokeOpacity: 1, strokeWeight, scale: 3 },
                  offset: '0', repeat: zone.lineStyle === 'dotted' ? `${strokeWeight * 4}px` : '12px',
                }],
              }
            : { strokeColor: stroke, strokeOpacity: 1, strokeWeight }
          return geoms.flatMap((geom, gi) => {
            const key = `zone-${zone.id}-${gi}`
            if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
              const polys: number[][][][] = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
              return polys.map((rings, pi) => (
                <PolygonF
                  key={`${key}-${pi}`}
                  paths={rings.map(toPath)}
                  options={{ fillColor: zone.color, fillOpacity, strokeColor: stroke, strokeWeight, strokeOpacity: 1, clickable: true, zIndex: 0 }}
                  onClick={select}
                />
              ))
            }
            if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
              const lines: number[][][] = geom.type === 'LineString' ? [geom.coordinates] : geom.coordinates
              return lines.flatMap((line, li) => {
                const polyline = (
                  <PolylineF key={`${key}-${li}`} path={toPath(line)} options={{ ...lineOptions, clickable: true, zIndex: 1 }} onClick={select} />
                )
                // A glyph badge mid-way along each substantial stretch says what the line is.
                const mid = glyph ? lineMidpoint(line, BADGE_MIN_LINE_M) : null
                return mid
                  ? [polyline, (
                      <MarkerF key={`${key}-${li}-badge`} position={mid} icon={planLayerIcon('badge', stroke, glyph!, isSelected)} onClick={select} zIndex={3} />
                    )]
                  : [polyline]
              })
            }
            if (geom.type === 'Point') {
              const [lng, lat] = geom.coordinates as number[]
              return [(
                <MarkerF
                  key={key}
                  position={{ lat, lng }}
                  icon={glyph
                    ? planLayerIcon('point', zone.color, glyph, isSelected)
                    : { path: google.maps.SymbolPath.CIRCLE, scale: isSelected ? 9 : 7, fillColor: zone.color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }}
                  onClick={select}
                  zIndex={glyph ? 4 : 2}
                />
              )]
            }
            return []
          })
        })}

        {/* Existing Polygon Pins */}
        {polygonPins.map(pin => {
          const coords = polygonPaths.get(pin.id) || []
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
              onClick={() => selectPin(pin.id, getShapeCentroid(pin.geometry as GeoJSONGeometry))}
              onMouseOver={() => setHoveredPin(pin.id)}
              onMouseOut={() => setHoveredPin(null)}
            />
          )
        })}

        {/* Existing Line Pins */}
        {linePins.map(pin => {
          const coords = linePaths.get(pin.id) || []
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
              onClick={() => selectPin(pin.id, getShapeCentroid(pin.geometry as GeoJSONGeometry))}
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
            icon={getPinIcon(pin.category, hoveredPin === pin.id, Boolean(pin.resolved))}
            title={pin.comment ? pin.comment.split(/(?<=[.!?])\s+/)[0] : undefined}
            onClick={() => {
              if (selectedPin === pin.id) {
                closePopup()
              } else {
                selectPin(pin.id, { lat: pin.latitude!, lng: pin.longitude! })
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

        {/* Selected Zone Popup */}
        {selectedZone && (() => {
          const zone = zones.find(z => z.id === selectedZone)
          const first = (zone?.geometries?.[0] ?? zone?.geometry) as any
          if (!zone || !first) return null
          const position = first.type === 'Point'
            ? { lat: first.coordinates[1], lng: first.coordinates[0] }
            : first.type === 'MultiPolygon' ? getShapeCentroid({ type: 'Polygon', coordinates: first.coordinates[0] } as GeoJSONGeometry)
            : first.type === 'MultiLineString' ? getShapeCentroid({ type: 'LineString', coordinates: first.coordinates[0] } as GeoJSONGeometry)
            : getShapeCentroid(first as GeoJSONGeometry)
          return (
            <OverlayView position={position} mapPaneName={OverlayView.FLOAT_PANE}>
              <div style={{ transform: 'translate(-50%, -100%)' }} className="mb-2">
                <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 w-64">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 leading-tight">{zone.name}</h3>
                    <button onClick={() => setSelectedZone(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none" aria-label="Close">×</button>
                  </div>
                  {zone.status && <div className="mt-1 text-xs font-medium" style={{ color: zone.color }}>{zone.status}</div>}
                  {zone.blurb && <p className="mt-2 text-sm text-slate-600 leading-relaxed">{zone.blurb}</p>}
                </div>
              </div>
            </OverlayView>
          )
        })()}

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
          const isLongDesc = description.length > 120
          const truncatedDesc = isLongDesc ? description.slice(0, 120).trimEnd() + '…' : description

          return (
            <OverlayView
              position={position}
              mapPaneName={OverlayView.FLOAT_PANE}
            >
              <div
                className={`bg-white rounded-xl shadow-2xl p-4 relative ${closingPin === pin.id ? 'animate-popup-out' : 'animate-popup'}`}
                style={{ width: '320px', maxWidth: 'calc(100vw - 32px)', fontFamily: "'DM Sans', sans-serif" }}
              >
                <button
                  onClick={closePopup}
                  aria-label="Close popup"
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
                    {pin.resolved && (
                      <span className="text-xs font-bold text-white px-3 py-1 rounded-full whitespace-nowrap bg-green-600">
                        RESOLVED
                      </span>
                    )}
                    {shapeLabel && (
                      <span className="text-xs font-medium text-brand-600 bg-brand-100 px-2 py-0.5 rounded">
                        {shapeLabel}
                      </span>
                    )}
                  </div>
                </div>

                {pin.photoUrl && (
                  <a href={pin.photoUrl} target="_blank" rel="noopener noreferrer" className="block mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pin.photoUrl}
                      alt="Photo attached to this report"
                      className="w-full max-h-36 object-cover rounded-lg border border-gray-200"
                    />
                  </a>
                )}

                {description && (
                  <div className="mb-3">
                    <p className="text-sm text-gray-500 leading-relaxed max-h-40 overflow-y-auto">
                      {showFullComment || !isLongDesc ? description : truncatedDesc}
                    </p>
                    {isLongDesc && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowFullComment(v => !v)
                        }}
                        className="mt-1 text-xs font-medium text-brand-600 hover:underline"
                      >
                        {showFullComment ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}

                {pin.resolvedNotes && (
                  <div className="mb-3 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs font-semibold text-green-700 mb-1">What was done</p>
                    <p className="text-sm text-green-800 leading-relaxed">{pin.resolvedNotes}</p>
                  </div>
                )}

                {pin.createdAt && (
                  <p className="text-xs text-gray-400 mb-3">
                    {new Date(pin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}

                {votedPins.has(pin.id) ? (
                  <div className="w-full flex items-center justify-center py-2 mb-3 border border-green-200 bg-green-50 rounded-lg">
                    <ThumbsUp size={18} className="text-green-500 mr-2" fill="currentColor" />
                    <span className="text-green-700 font-medium mr-1">{pin.votes}</span>
                    <span className="text-green-600">{issuesMode ? 'Also affected' : 'Voted'}</span>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onVote(pin.id)
                    }}
                    className="w-full flex items-center justify-center py-2 mb-3 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                    style={{
                      ['--hover-bg' as string]: primaryColor ? `${primaryColor}15` : undefined,
                      ['--hover-border' as string]: primaryColor || undefined
                    }}
                    onMouseOver={(e) => {
                      if (primaryColor) {
                        e.currentTarget.style.backgroundColor = `${primaryColor}15`
                        e.currentTarget.style.borderColor = primaryColor
                      } else {
                        e.currentTarget.style.backgroundColor = 'rgb(236 253 245)'
                        e.currentTarget.style.borderColor = 'rgb(110 231 183)'
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = ''
                      e.currentTarget.style.borderColor = ''
                    }}
                  >
                    <ThumbsUp size={18} className="mr-2" style={{ color: primaryColor || '#10B981' }} />
                    <span className="text-gray-700 font-medium mr-1">{pin.votes}</span>
                    <span className="text-gray-500">{issuesMode ? "I'm affected too" : `Vote${pin.votes !== 1 ? 's' : ''}`}</span>
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
})

export default EmbedMap
