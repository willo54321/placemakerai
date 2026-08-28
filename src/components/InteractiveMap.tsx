'use client'

import { useEffect, useRef, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF, PolygonF, PolylineF, DrawingManagerF, OverlayView } from '@react-google-maps/api'
import { X } from 'lucide-react'
import { RotatableOverlay, calculateRotationAngle, snapAngle } from './RotatableOverlay'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry")[] = ['drawing', 'geometry']

export interface MapMarker {
  id: string
  label: string
  latitude?: number | null
  longitude?: number | null
  color: string
  notes: string | null
  type?: string
}

export interface MapDrawing {
  id: string
  type: 'polygon' | 'line'
  geometry: GeoJSON.Geometry
  label: string
  color: string
  notes?: string | null
  area?: number
  length?: number
}

export interface ImageOverlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  rotation: number
  visible: boolean
}

export interface GeoLayer {
  id: string
  name: string
  type: string
  geojson: GeoJSON.FeatureCollection
  style: {
    fillColor: string
    strokeColor: string
    fillOpacity: number
    strokeWidth: number
  }
  visible: boolean
}

export interface InteractiveMapRef {
  fitToOverlay: (bounds: [[number, number], [number, number]]) => void
}

export interface SpotlightPolygon {
  coordinates: number[][][] // GeoJSON Polygon coordinates
  strokeColor?: string
  strokeWeight?: number
}

interface InteractiveMapProps {
  center: [number, number]
  zoom: number
  markers: MapMarker[]
  drawings?: MapDrawing[]
  overlays?: ImageOverlay[]
  geoLayers?: GeoLayer[]
  selectedOverlayId?: string | null
  spotlightPolygon?: SpotlightPolygon | null // Spotlight effect - darkens map except this area
  isAddingMarker?: boolean
  isDrawingMode?: boolean
  activeDrawingTool?: 'polygon' | 'line' | null
  activeDrawingColor?: string
  onMapClick?: (lat: number, lng: number) => void
  onMarkerClick?: (markerId: string) => void
  onDrawingCreated?: (geometry: GeoJSON.Geometry, type: 'polygon' | 'line') => void
  onDrawingClick?: (drawingId: string) => void
  onBoundsChange?: (center: [number, number], zoom: number) => void
  onOverlayClick?: (overlayId: string) => void
  onOverlayBoundsChange?: (overlayId: string, bounds: [[number, number], [number, number]]) => void
  onOverlayRotationChange?: (overlayId: string, rotation: number) => void
  // Imperative API exposed via a normal prop, because next/dynamic does NOT
  // forward refs in Next 14 (so the `ref`/useImperativeHandle path silently
  // fails when this component is loaded via dynamic()). Consumers that go
  // through next/dynamic should use `apiRef` instead of `ref`.
  apiRef?: React.MutableRefObject<InteractiveMapRef | null>
}

function createMarkerIcon(color: string, isHovered: boolean = false): google.maps.Icon {
  const shadowBlur = isHovered ? '3' : '2'
  const shadowOpacity = isHovered ? '0.3' : '0.2'
  const size = isHovered ? 40 : 36
  const height = isHovered ? 50 : 45

  const svg = `
    <svg width="${size}" height="${height}" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M18 2C9.7 2 3 8.7 3 17c0 11 15 25 15 25s15-14 15-25c0-8.3-6.7-15-15-15z" fill="${color}"/>
        <circle cx="18" cy="16" r="7" fill="white"/>
      </g>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height)
  }
}

function createNumberedMarkerIcon(color: string, number: string | number, isHovered: boolean = false): google.maps.Icon {
  const shadowBlur = isHovered ? '3' : '2'
  const shadowOpacity = isHovered ? '0.3' : '0.2'
  const size = isHovered ? 40 : 36
  const height = isHovered ? 50 : 45
  const fontSize = String(number).length > 1 ? '11' : '13'

  const svg = `
    <svg width="${size}" height="${height}" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M18 2C9.7 2 3 8.7 3 17c0 11 15 25 15 25s15-14 15-25c0-8.3-6.7-15-15-15z" fill="${color}"/>
        <circle cx="18" cy="16" r="9" fill="white"/>
        <text x="18" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${color}">${number}</text>
      </g>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height)
  }
}

// Icon paths for tour stop markers
const MARKER_ICON_PATHS: Record<string, string> = {
  nature: 'M18 6c-2 0-3.5 1.5-3.5 3.5c0 1.2.6 2.3 1.5 3v.5h4v-.5c.9-.7 1.5-1.8 1.5-3C21.5 7.5 20 6 18 6zm-2 10v4h4v-4h2v6h-8v-6h2z', // Tree
  access: 'M18 8a2 2 0 1 0 0-4a2 2 0 0 0 0 4zm2 3h-4a1 1 0 0 0-1 1v4h2v8h2v-8h2v-4a1 1 0 0 0-1-1z', // Wheelchair/person
  parking: 'M12 6h5a4 4 0 0 1 0 8h-3v6h-2V6zm2 6h3a2 2 0 1 0 0-4h-3v4z', // P
  info: 'M18 6a2 2 0 1 0 0 4a2 2 0 0 0 0-4zm-1 6h2v10h-2V12z', // i
  home: 'M18 6l-8 6v12h5v-6h6v6h5V12l-8-6z', // House
  food: 'M11 6v8h2v10h2V14h2V6h-2v6h-2V6h-2zm10 0v18h2V6h-2z', // Fork & knife
  play: 'M10 6v18l14-9L10 6z', // Play triangle
  water: 'M18 6c-4 4-6 7-6 10a6 6 0 1 0 12 0c0-3-2-6-6-10z', // Water drop
  start: 'M18 6l2 4l4.5.7l-3.3 3.2l.8 4.5L18 16l-4 2.4l.8-4.5l-3.3-3.2L16 10l2-4z', // Star
  view: 'M18 8c-5 0-9 4-9 8s4 8 9 8s9-4 9-8s-4-8-9-8zm0 14c-3.3 0-6-2.7-6-6s2.7-6 6-6s6 2.7 6 6s-2.7 6-6 6zm0-10a4 4 0 1 0 0 8a4 4 0 0 0 0-8z', // Eye/viewpoint
}

export const TOUR_STOP_ICONS = [
  { id: 'number', label: 'Number', icon: '1' },
  { id: 'nature', label: 'Nature', icon: '🌳' },
  { id: 'access', label: 'Access', icon: '♿' },
  { id: 'parking', label: 'Parking', icon: '🅿️' },
  { id: 'info', label: 'Info', icon: 'ℹ️' },
  { id: 'home', label: 'Building', icon: '🏠' },
  { id: 'food', label: 'Food', icon: '🍴' },
  { id: 'play', label: 'Recreation', icon: '▶️' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'start', label: 'Start', icon: '⭐' },
  { id: 'view', label: 'Viewpoint', icon: '👁️' },
]

function createIconMarkerIcon(color: string, iconType: string, isHovered: boolean = false): google.maps.Icon {
  const shadowBlur = isHovered ? '3' : '2'
  const shadowOpacity = isHovered ? '0.3' : '0.2'
  const size = isHovered ? 40 : 36
  const height = isHovered ? 50 : 45
  const iconPath = MARKER_ICON_PATHS[iconType] || MARKER_ICON_PATHS.info

  const svg = `
    <svg width="${size}" height="${height}" viewBox="0 0 36 45" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M18 2C9.7 2 3 8.7 3 17c0 11 15 25 15 25s15-14 15-25c0-8.3-6.7-15-15-15z" fill="${color}"/>
        <circle cx="18" cy="16" r="10" fill="white"/>
        <g transform="translate(9, 7) scale(0.5)">
          <path d="${iconPath}" fill="${color}"/>
        </g>
      </g>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height)
  }
}

// Cache marker icons so we don't allocate a brand-new google.maps.Icon object
// (which triggers marker.setIcon churn) on every render / every hover. Keyed by
// the parameters that actually affect the produced icon.
const markerIconCache = new globalThis.Map<string, google.maps.Icon>()

function getMarkerIcon(
  color: string,
  label: string,
  type: string | undefined,
  isHovered: boolean
): google.maps.Icon {
  let kind: 'icon' | 'number' | 'plain'
  if (type && type !== 'number' && MARKER_ICON_PATHS[type]) {
    kind = 'icon'
  } else if (label && /^\d+$/.test(label)) {
    kind = 'number'
  } else {
    kind = 'plain'
  }

  // Only the values that vary the SVG output participate in the cache key.
  const keyLabel = kind === 'number' ? label : ''
  const keyType = kind === 'icon' ? type : ''
  const cacheKey = `${kind}|${color}|${keyType}|${keyLabel}|${isHovered ? 1 : 0}`

  const cached = markerIconCache.get(cacheKey)
  if (cached) return cached

  let icon: google.maps.Icon
  if (kind === 'icon') {
    icon = createIconMarkerIcon(color, type as string, isHovered)
  } else if (kind === 'number') {
    icon = createNumberedMarkerIcon(color, label, isHovered)
  } else {
    icon = createMarkerIcon(color, isHovered)
  }

  markerIconCache.set(cacheKey, icon)
  return icon
}

function createResizeHandleIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#7c3aed',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
  } as google.maps.Symbol
}

function createRotationHandleIcon(): google.maps.Symbol {
  return {
    path: 'M -8 0 A 8 8 0 1 1 8 0 A 8 8 0 1 1 -8 0 M -4 -2 L 0 -6 L 4 -2',
    scale: 1,
    fillColor: '#059669',
    fillOpacity: 1,
    strokeColor: '#FFFFFF',
    strokeWeight: 2,
  }
}

const InteractiveMap = forwardRef<InteractiveMapRef, InteractiveMapProps>(({
  center,
  zoom,
  markers,
  drawings = [],
  overlays = [],
  geoLayers = [],
  selectedOverlayId = null,
  spotlightPolygon = null,
  isAddingMarker = false,
  isDrawingMode = false,
  activeDrawingTool = null,
  activeDrawingColor = '#3B82F6',
  onMapClick,
  onMarkerClick,
  onDrawingCreated,
  onDrawingClick,
  onBoundsChange,
  onOverlayClick,
  onOverlayBoundsChange,
  onOverlayRotationChange,
  apiRef
}, ref) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null)
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null)
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false)
  const [dragStartPos, setDragStartPos] = useState<{ lat: number; lng: number } | null>(null)
  const [dragStartBounds, setDragStartBounds] = useState<[[number, number], [number, number]] | null>(null)
  const [isRotatingOverlay, setIsRotatingOverlay] = useState(false)
  const [rotationStartAngle, setRotationStartAngle] = useState<number>(0)
  const overlayRefs = useRef(new globalThis.Map<string, RotatableOverlay>())
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null)
  const zoomRafRef = useRef<number | null>(null)

  const mapCenter = useMemo(() => ({ lat: center[0], lng: center[1] }), [center[0], center[1]])

  // Build the imperative API once per `map` change so it can be shared between
  // the forwarded ref (backward compat) and the `apiRef` prop (used through
  // next/dynamic, which doesn't forward refs in Next 14).
  const imperativeApi = useMemo<InteractiveMapRef>(() => ({
    fitToOverlay: (bounds: [[number, number], [number, number]]) => {
      if (map) {
        const googleBounds = new google.maps.LatLngBounds(
          { lat: bounds[0][0], lng: bounds[0][1] },
          { lat: bounds[1][0], lng: bounds[1][1] }
        )
        map.fitBounds(googleBounds, 50)
      }
    }
  }), [map])

  useImperativeHandle(ref, () => imperativeApi, [imperativeApi])

  // Populate the apiRef prop (next/dynamic-safe alternative to `ref`).
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = imperativeApi
    return () => {
      apiRef.current = null
    }
  }, [apiRef, imperativeApi])

  const onLoad = useCallback((map: google.maps.Map) => {
    map.setCenter({ lat: center[0], lng: center[1] })
    map.setZoom(zoom)
    setMap(map)

    setTimeout(() => {
      google.maps.event.trigger(map, 'resize')
      map.setCenter({ lat: center[0], lng: center[1] })
    }, 100)
  }, [center, zoom])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng && isAddingMarker && onMapClick) {
      onMapClick(e.latLng.lat(), e.latLng.lng())
    }
    setSelectedMarker(null)
    setSelectedDrawing(null)
  }, [isAddingMarker, onMapClick])

  useEffect(() => {
    if (!map || !onBoundsChange) return

    const listener = map.addListener('idle', () => {
      const center = map.getCenter()
      const zoom = map.getZoom()
      if (center && zoom !== undefined) {
        onBoundsChange([center.lat(), center.lng()], zoom)
      }
    })

    return () => google.maps.event.removeListener(listener)
  }, [map, onBoundsChange])

  // Sync zoom when prop changes (for tour wizard zoom slider) with smooth easing
  useEffect(() => {
    if (!map) return

    // Cancel any in-flight animation before starting a new one so we never run
    // two rAF loops concurrently (which fought over map.setZoom and leaked
    // frames when the effect re-ran mid-animation).
    if (zoomRafRef.current !== null) {
      cancelAnimationFrame(zoomRafRef.current)
      zoomRafRef.current = null
    }

    const currentZoom = map.getZoom()
    if (currentZoom === undefined || currentZoom === zoom) return

    const diff = zoom - currentZoom
    const steps = Math.abs(diff) * 4 // More steps for smoother animation
    let step = 0

    const easeInOutQuad = (t: number) => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    }

    const animate = () => {
      step++
      const progress = easeInOutQuad(step / steps)
      const newZoom = currentZoom + (diff * progress)
      map.setZoom(newZoom)

      if (step < steps) {
        zoomRafRef.current = requestAnimationFrame(animate)
      } else {
        zoomRafRef.current = null
      }
    }

    if (steps > 0) {
      zoomRafRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (zoomRafRef.current !== null) {
        cancelAnimationFrame(zoomRafRef.current)
        zoomRafRef.current = null
      }
    }
  }, [map, zoom])

  // Keep the latest onOverlayClick in a ref so we can diff overlays without the
  // effect re-running (and tearing down every overlay) whenever the handler
  // identity changes.
  const onOverlayClickRef = useRef(onOverlayClick)
  useEffect(() => {
    onOverlayClickRef.current = onOverlayClick
  }, [onOverlayClick])

  // Diff overlays by id: create new ones, remove deleted ones, and update
  // existing instances in place via setBounds/setRotation/setOpacity so we
  // don't tear down and recreate every RotatableOverlay on each change
  // (which caused image flicker/thrash on drag, opacity/rotation edits, etc.).
  useEffect(() => {
    if (!map) return

    // Only visible overlays should have a live instance on the map.
    const visibleOverlays = overlays.filter(o => o.visible)
    const visibleIds = new Set(visibleOverlays.map(o => o.id))

    // Remove instances that are gone or no longer visible.
    overlayRefs.current.forEach((instance, id) => {
      if (!visibleIds.has(id)) {
        instance.setMap(null)
        overlayRefs.current.delete(id)
      }
    })

    // Create new instances, or update existing ones in place.
    visibleOverlays.forEach(overlay => {
      const existing = overlayRefs.current.get(overlay.id)

      if (existing) {
        const nextRotation = overlay.rotation || 0
        const prevBounds = existing.getBounds()
        const boundsChanged =
          prevBounds[0][0] !== overlay.bounds[0][0] ||
          prevBounds[0][1] !== overlay.bounds[0][1] ||
          prevBounds[1][0] !== overlay.bounds[1][0] ||
          prevBounds[1][1] !== overlay.bounds[1][1]

        if (existing.getOpacity() !== overlay.opacity) {
          existing.setOpacity(overlay.opacity)
        }
        if (existing.getRotation() !== nextRotation) {
          existing.setRotation(nextRotation)
        }
        if (boundsChanged) {
          existing.setBounds(overlay.bounds)
        }
      } else {
        const rotatableOverlay = new RotatableOverlay({
          imageUrl: overlay.imageUrl,
          bounds: overlay.bounds,
          rotation: overlay.rotation || 0,
          opacity: overlay.opacity,
          clickable: true,
          onClick: () => {
            onOverlayClickRef.current?.(overlay.id)
          }
        })

        rotatableOverlay.setMap(map)
        overlayRefs.current.set(overlay.id, rotatableOverlay)
      }
    })
  }, [map, overlays])

  // Only remove all overlays on unmount / map change.
  useEffect(() => {
    if (!map) return
    const refs = overlayRefs.current
    return () => {
      refs.forEach((instance) => {
        instance.setMap(null)
      })
      refs.clear()
    }
  }, [map])

  const handlePolygonComplete = useCallback((polygon: google.maps.Polygon) => {
    if (!onDrawingCreated) return

    const path = polygon.getPath()
    const coordinates: [number, number][] = []
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      coordinates.push([point.lng(), point.lat()])
    }
    if (coordinates.length > 0) {
      coordinates.push(coordinates[0])
    }

    polygon.setMap(null)
    onDrawingCreated({ type: 'Polygon', coordinates: [coordinates] }, 'polygon')
  }, [onDrawingCreated])

  const handlePolylineComplete = useCallback((polyline: google.maps.Polyline) => {
    if (!onDrawingCreated) return

    const path = polyline.getPath()
    const coordinates: [number, number][] = []
    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i)
      coordinates.push([point.lng(), point.lat()])
    }

    polyline.setMap(null)
    onDrawingCreated({ type: 'LineString', coordinates }, 'line')
  }, [onDrawingCreated])

  useEffect(() => {
    if (drawingManagerRef.current) {
      if (isDrawingMode && activeDrawingTool === 'polygon') {
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYGON)
      } else if (isDrawingMode && activeDrawingTool === 'line') {
        drawingManagerRef.current.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE)
      } else {
        drawingManagerRef.current.setDrawingMode(null)
      }
    }
  }, [isDrawingMode, activeDrawingTool])

  const drawingManagerOptions = useMemo(() => ({
    drawingMode: null as google.maps.drawing.OverlayType | null,
    drawingControl: false,
    polygonOptions: {
      fillColor: activeDrawingColor,
      fillOpacity: 0.3,
      strokeColor: activeDrawingColor,
      strokeWeight: 3,
      editable: false,
      clickable: false,
    },
    polylineOptions: {
      strokeColor: activeDrawingColor,
      strokeWeight: 3,
      editable: false,
      clickable: false,
    }
  }), [activeDrawingColor])

  const selectedOverlay = overlays.find(o => o.id === selectedOverlayId)

  const handleOverlayDragStart = useCallback((overlay: ImageOverlay, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    setIsDraggingOverlay(true)
    setDragStartPos({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    setDragStartBounds(overlay.bounds)
  }, [])

  const handleOverlayDrag = useCallback((overlay: ImageOverlay, e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !dragStartPos || !dragStartBounds || !onOverlayBoundsChange) return

    const deltaLat = e.latLng.lat() - dragStartPos.lat
    const deltaLng = e.latLng.lng() - dragStartPos.lng

    const newBounds: [[number, number], [number, number]] = [
      [dragStartBounds[0][0] + deltaLat, dragStartBounds[0][1] + deltaLng],
      [dragStartBounds[1][0] + deltaLat, dragStartBounds[1][1] + deltaLng]
    ]

    onOverlayBoundsChange(overlay.id, newBounds)
  }, [dragStartPos, dragStartBounds, onOverlayBoundsChange])

  const handleOverlayDragEnd = useCallback(() => {
    setIsDraggingOverlay(false)
    setDragStartPos(null)
    setDragStartBounds(null)
  }, [])

  const handleCornerDrag = useCallback((cornerId: string, overlay: ImageOverlay, e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !onOverlayBoundsChange) return

    const newLat = e.latLng.lat()
    const newLng = e.latLng.lng()
    let newBounds: [[number, number], [number, number]]

    switch (cornerId) {
      case 'sw':
        newBounds = [[newLat, newLng], [overlay.bounds[1][0], overlay.bounds[1][1]]]
        break
      case 'nw':
        newBounds = [[overlay.bounds[0][0], newLng], [newLat, overlay.bounds[1][1]]]
        break
      case 'ne':
        newBounds = [[overlay.bounds[0][0], overlay.bounds[0][1]], [newLat, newLng]]
        break
      case 'se':
        newBounds = [[newLat, overlay.bounds[0][1]], [overlay.bounds[1][0], newLng]]
        break
      default:
        return
    }

    onOverlayBoundsChange(overlay.id, newBounds)
  }, [onOverlayBoundsChange])

  // Rotation handle handlers
  const handleRotationStart = useCallback((overlay: ImageOverlay, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    setIsRotatingOverlay(true)
    setRotationStartAngle(overlay.rotation || 0)
  }, [])

  const handleRotationDrag = useCallback((overlay: ImageOverlay, e: google.maps.MapMouseEvent) => {
    if (!e.latLng || !isRotatingOverlay || !onOverlayRotationChange) return

    const centerLat = (overlay.bounds[0][0] + overlay.bounds[1][0]) / 2
    const centerLng = (overlay.bounds[0][1] + overlay.bounds[1][1]) / 2
    const mouseLat = e.latLng.lat()
    const mouseLng = e.latLng.lng()

    let newRotation = calculateRotationAngle(centerLat, centerLng, mouseLat, mouseLng)

    // Snap to 15 degree increments when shift key would be held (we can't detect shift in drag, so skip for now)
    // newRotation = snapAngle(newRotation)

    onOverlayRotationChange(overlay.id, newRotation)
  }, [isRotatingOverlay, onOverlayRotationChange])

  const handleRotationEnd = useCallback(() => {
    setIsRotatingOverlay(false)
    setRotationStartAngle(0)
  }, [])

  // Memoize the GoogleMap options object so we don't hand a fresh literal to
  // <GoogleMap> on every render (which caused constant map.setOptions churn).
  // Gated on isLoaded because it references google.maps.* enums.
  const mapOptions = useMemo<google.maps.MapOptions | undefined>(() => {
    if (!isLoaded) return undefined
    return {
      mapTypeId: 'hybrid',
      mapTypeControl: true,
      mapTypeControlOptions: {
        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
        position: google.maps.ControlPosition.TOP_RIGHT,
      },
      streetViewControl: false,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.TOP_LEFT,
      },
      clickableIcons: false,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_CENTER,
      },
      scaleControl: true,
      rotateControl: false,
      panControl: false,
      tilt: 0,
      gestureHandling: 'greedy',
      maxZoom: 17,
      minZoom: 10,
    }
  }, [isLoaded])

  // Memoize the geoLayer feature -> Google LatLng path conversion + elements.
  // Boundary layers can carry thousands of vertices; recomputing these paths on
  // every render (previously done inline in JSX) is expensive. Gated on isLoaded
  // because Point features build a google.maps icon.
  const geoLayerElements = useMemo(() => {
    if (!isLoaded) return null
    return geoLayers.filter(layer => layer.visible).map(layer => {
      const features = layer.geojson?.features || []
      const fillColor = layer.style?.fillColor || '#3B82F6'
      const fillOpacity = layer.style?.fillOpacity || 0.3
      const strokeColor = layer.style?.strokeColor || '#1E40AF'
      const strokeWeight = layer.style?.strokeWidth || 2
      return features.map((feature, featureIndex) => {
        const geometry = feature.geometry
        if (!geometry) return null

        if (geometry.type === 'Polygon') {
          const paths = geometry.coordinates[0].map((coord: number[]) => ({
            lat: coord[1], lng: coord[0]
          }))
          return (
            <PolygonF
              key={`${layer.id}-${featureIndex}`}
              paths={paths}
              options={{
                fillColor,
                fillOpacity,
                strokeColor,
                strokeWeight,
                strokeOpacity: 0.8,
                clickable: false
              }}
            />
          )
        } else if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.map((polygonCoords: number[][][], polyIndex: number) => {
            const paths = polygonCoords[0].map((coord: number[]) => ({
              lat: coord[1], lng: coord[0]
            }))
            return (
              <PolygonF
                key={`${layer.id}-${featureIndex}-${polyIndex}`}
                paths={paths}
                options={{
                  fillColor,
                  fillOpacity,
                  strokeColor,
                  strokeWeight,
                  strokeOpacity: 0.8,
                  clickable: false
                }}
              />
            )
          })
        } else if (geometry.type === 'LineString') {
          const path = geometry.coordinates.map((coord: number[]) => ({
            lat: coord[1], lng: coord[0]
          }))
          return (
            <PolylineF
              key={`${layer.id}-${featureIndex}`}
              path={path}
              options={{
                strokeColor,
                strokeWeight,
                strokeOpacity: 0.8,
                clickable: false
              }}
            />
          )
        } else if (geometry.type === 'MultiLineString') {
          return geometry.coordinates.map((lineCoords: number[][], lineIndex: number) => {
            const path = lineCoords.map((coord: number[]) => ({
              lat: coord[1], lng: coord[0]
            }))
            return (
              <PolylineF
                key={`${layer.id}-${featureIndex}-${lineIndex}`}
                path={path}
                options={{
                  strokeColor,
                  strokeWeight,
                  strokeOpacity: 0.8,
                  clickable: false
                }}
              />
            )
          })
        } else if (geometry.type === 'Point') {
          return (
            <MarkerF
              key={`${layer.id}-${featureIndex}`}
              position={{ lat: geometry.coordinates[1], lng: geometry.coordinates[0] }}
              icon={getMarkerIcon(fillColor, '', undefined, false)}
            />
          )
        }
        return null
      })
    })
  }, [isLoaded, geoLayers])

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 rounded-xl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Loading map...</span>
        </div>
      </div>
    )
  }

  const geoJsonToGooglePaths = (geometry: GeoJSON.Geometry): google.maps.LatLngLiteral[] => {
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0].map(coord => ({ lat: coord[1], lng: coord[0] }))
    } else if (geometry.type === 'LineString') {
      return geometry.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }))
    }
    return []
  }

  return (
    <div className="relative h-full w-full">
      <style>{`
        .gm-style a[href^="https://maps.google.com/maps"],
        .gm-style .gm-style-cc { display: none !important; }
      `}</style>

      <GoogleMap
        mapContainerStyle={{
          height: '100%',
          width: '100%',
          borderRadius: '12px',
          cursor: isAddingMarker || isDrawingMode ? 'crosshair' : isDraggingOverlay ? 'grabbing' : 'grab'
        }}
        center={mapCenter}
        zoom={zoom}
        options={mapOptions}
        onClick={handleMapClick}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        <DrawingManagerF
          onLoad={(dm) => {
            drawingManagerRef.current = dm
            if (isDrawingMode && activeDrawingTool === 'polygon') {
              dm.setDrawingMode(google.maps.drawing.OverlayType.POLYGON)
            } else if (isDrawingMode && activeDrawingTool === 'line') {
              dm.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE)
            }
          }}
          options={drawingManagerOptions}
          onPolygonComplete={handlePolygonComplete}
          onPolylineComplete={handlePolylineComplete}
        />

        {geoLayerElements}

        {drawings.map(drawing => {
          if (drawing.type === 'polygon' && drawing.geometry.type === 'Polygon') {
            const paths = geoJsonToGooglePaths(drawing.geometry)
            return (
              <PolygonF
                key={drawing.id}
                paths={paths}
                options={{
                  fillColor: drawing.color,
                  fillOpacity: 0.25,
                  strokeColor: drawing.color,
                  strokeWeight: 3,
                  strokeOpacity: 0.9,
                  clickable: true
                }}
                onClick={() => onDrawingClick ? onDrawingClick(drawing.id) : setSelectedDrawing(drawing.id)}
              />
            )
          } else if (drawing.type === 'line' && drawing.geometry.type === 'LineString') {
            const path = geoJsonToGooglePaths(drawing.geometry)
            return (
              <PolylineF
                key={drawing.id}
                path={path}
                options={{
                  strokeColor: drawing.color,
                  strokeWeight: 4,
                  strokeOpacity: 0.9,
                  clickable: true
                }}
                onClick={() => onDrawingClick ? onDrawingClick(drawing.id) : setSelectedDrawing(drawing.id)}
              />
            )
          }
          return null
        })}

        {/* Spotlight effect - dark overlay with hole for highlighted area */}
        {spotlightPolygon && spotlightPolygon.coordinates && spotlightPolygon.coordinates[0] && (
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
              spotlightPolygon.coordinates[0].map(coord => ({
                lat: coord[1],
                lng: coord[0]
              })).reverse()
            ]}
            options={{
              fillColor: '#000000',
              fillOpacity: 0.5,
              strokeColor: spotlightPolygon.strokeColor || '#F59E0B',
              strokeWeight: spotlightPolygon.strokeWeight ?? 3,
              strokeOpacity: 1,
              clickable: false,
              zIndex: 5
            }}
          />
        )}

        {markers.filter(m => m.latitude != null && m.longitude != null).map(marker => (
          <MarkerF
            key={marker.id}
            position={{ lat: marker.latitude!, lng: marker.longitude! }}
            icon={getMarkerIcon(marker.color, marker.label, marker.type, hoveredMarker === marker.id)}
            onClick={() => onMarkerClick ? onMarkerClick(marker.id) : setSelectedMarker(marker.id)}
            onMouseOver={() => setHoveredMarker(marker.id)}
            onMouseOut={() => setHoveredMarker(null)}
            cursor="pointer"
          />
        ))}

        {selectedMarker && (() => {
          const marker = markers.find(m => m.id === selectedMarker)
          if (!marker || marker.latitude == null || marker.longitude == null) return null

          return (
            <OverlayView
              position={{ lat: marker.latitude, lng: marker.longitude }}
              mapPaneName={OverlayView.FLOAT_PANE}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 relative animate-in fade-in zoom-in-95 duration-200"
                style={{
                  width: '280px',
                  transform: 'translate(-50%, calc(-100% - 50px))',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <button
                  onClick={() => setSelectedMarker(null)}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={14} className="text-slate-500" />
                </button>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: marker.color }} />
                  <h3 className="font-semibold text-slate-900 text-sm">{marker.label}</h3>
                </div>
                {marker.notes && (
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">{marker.notes}</p>
                )}
                <p className="text-xs text-slate-400 font-mono">
                  {marker.latitude.toFixed(6)}, {marker.longitude.toFixed(6)}
                </p>
              </div>
            </OverlayView>
          )
        })()}

        {selectedDrawing && (() => {
          const drawing = drawings.find(d => d.id === selectedDrawing)
          if (!drawing) return null

          let position: google.maps.LatLngLiteral = mapCenter
          if (drawing.geometry.type === 'Polygon') {
            const coords = drawing.geometry.coordinates[0]
            const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length
            const avgLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length
            position = { lat: avgLat, lng: avgLng }
          } else if (drawing.geometry.type === 'LineString') {
            const coords = drawing.geometry.coordinates
            const midIdx = Math.floor(coords.length / 2)
            position = { lat: coords[midIdx][1], lng: coords[midIdx][0] }
          }

          const metrics = drawing.type === 'polygon'
            ? `Area: ${((drawing.area || 0) / 10000).toFixed(2)} ha`
            : `Length: ${((drawing.length || 0) / 1000).toFixed(2)} km`

          return (
            <OverlayView
              position={position}
              mapPaneName={OverlayView.FLOAT_PANE}
            >
              <div
                className="bg-white rounded-xl shadow-xl p-4 relative animate-in fade-in zoom-in-95 duration-200"
                style={{
                  width: '260px',
                  transform: 'translate(-50%, calc(-100% - 20px))',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}
              >
                <button
                  onClick={() => setSelectedDrawing(null)}
                  className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={14} className="text-slate-500" />
                </button>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: drawing.color }} />
                  <h3 className="font-semibold text-slate-900 text-sm">{drawing.label}</h3>
                </div>
                {drawing.notes && (
                  <p className="text-sm text-slate-600 leading-relaxed mb-2">{drawing.notes}</p>
                )}
                <p className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded inline-block">
                  {metrics}
                </p>
              </div>
            </OverlayView>
          )
        })()}

        {selectedOverlay && (() => {
          // Calculate rotated corners for the selection outline
          const rotation = selectedOverlay.rotation || 0
          const rad = (rotation * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)

          const centerLat = (selectedOverlay.bounds[0][0] + selectedOverlay.bounds[1][0]) / 2
          const centerLng = (selectedOverlay.bounds[0][1] + selectedOverlay.bounds[1][1]) / 2

          // Original corners (unrotated)
          const origCorners = [
            { lat: selectedOverlay.bounds[0][0], lng: selectedOverlay.bounds[0][1] }, // SW
            { lat: selectedOverlay.bounds[1][0], lng: selectedOverlay.bounds[0][1] }, // NW
            { lat: selectedOverlay.bounds[1][0], lng: selectedOverlay.bounds[1][1] }, // NE
            { lat: selectedOverlay.bounds[0][0], lng: selectedOverlay.bounds[1][1] }, // SE
          ]

          // Rotate each corner around center
          const rotatedCorners = origCorners.map(corner => {
            const dLat = corner.lat - centerLat
            const dLng = corner.lng - centerLng
            return {
              lat: centerLat + dLat * cos - dLng * sin,
              lng: centerLng + dLat * sin + dLng * cos
            }
          })

          return (
            <PolygonF
              paths={rotatedCorners}
              options={{
                fillColor: '#7c3aed',
                fillOpacity: 0,
                strokeColor: '#7c3aed',
                strokeWeight: 3,
                strokeOpacity: 1,
                clickable: true,
                draggable: true,
                zIndex: 10
              }}
              onDragStart={(e) => handleOverlayDragStart(selectedOverlay, e)}
              onDrag={(e) => handleOverlayDrag(selectedOverlay, e)}
              onDragEnd={handleOverlayDragEnd}
            />
          )
        })()}

        {selectedOverlay && (() => {
          // Calculate rotated corner positions for resize handles
          const rotation = selectedOverlay.rotation || 0
          const rad = (rotation * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)

          const centerLat = (selectedOverlay.bounds[0][0] + selectedOverlay.bounds[1][0]) / 2
          const centerLng = (selectedOverlay.bounds[0][1] + selectedOverlay.bounds[1][1]) / 2

          const origCorners = [
            { id: 'sw', lat: selectedOverlay.bounds[0][0], lng: selectedOverlay.bounds[0][1] },
            { id: 'nw', lat: selectedOverlay.bounds[1][0], lng: selectedOverlay.bounds[0][1] },
            { id: 'ne', lat: selectedOverlay.bounds[1][0], lng: selectedOverlay.bounds[1][1] },
            { id: 'se', lat: selectedOverlay.bounds[0][0], lng: selectedOverlay.bounds[1][1] },
          ]

          const corners = origCorners.map(corner => {
            const dLat = corner.lat - centerLat
            const dLng = corner.lng - centerLng
            return {
              id: corner.id,
              lat: centerLat + dLat * cos - dLng * sin,
              lng: centerLng + dLat * sin + dLng * cos
            }
          })

          return corners.map(corner => (
            <MarkerF
              key={`${selectedOverlay.id}-${corner.id}`}
              position={{ lat: corner.lat, lng: corner.lng }}
              draggable={true}
              icon={createResizeHandleIcon()}
              onDrag={(e) => handleCornerDrag(corner.id, selectedOverlay, e)}
              zIndex={11}
            />
          ))
        })()}

        {/* Rotation handle - positioned above the top edge of the overlay */}
        {selectedOverlay && (() => {
          const rotation = selectedOverlay.rotation || 0
          const rad = (rotation * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)

          const centerLat = (selectedOverlay.bounds[0][0] + selectedOverlay.bounds[1][0]) / 2
          const centerLng = (selectedOverlay.bounds[0][1] + selectedOverlay.bounds[1][1]) / 2

          // Position handle above the north edge
          const northLat = selectedOverlay.bounds[1][0]
          const handleOffset = (northLat - centerLat) * 1.2 // 20% above the top edge

          // Rotate the handle position
          const handleLat = centerLat + handleOffset * cos
          const handleLng = centerLng + handleOffset * sin

          return (
            <MarkerF
              key={`${selectedOverlay.id}-rotation`}
              position={{ lat: handleLat, lng: handleLng }}
              draggable={true}
              icon={createRotationHandleIcon()}
              onDragStart={(e) => handleRotationStart(selectedOverlay, e)}
              onDrag={(e) => handleRotationDrag(selectedOverlay, e)}
              onDragEnd={handleRotationEnd}
              zIndex={12}
            />
          )
        })()}
      </GoogleMap>
    </div>
  )
})

InteractiveMap.displayName = 'InteractiveMap'

export default InteractiveMap
