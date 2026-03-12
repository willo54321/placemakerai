'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Volume2, Wind, Car, AlertTriangle, ShieldAlert, Clock, HelpCircle, X, Send, MapPin, Pentagon } from 'lucide-react'
import dynamic from 'next/dynamic'

import type { EmbedMapHandle } from '../EmbedMap'

const EmbedMap = dynamic(() => import('../EmbedMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
})

// GeoJSON geometry types
interface GeoJSONGeometry {
  type: 'LineString' | 'Polygon'
  coordinates: number[][] | number[][][]
}

interface PublicPin {
  id: string
  shapeType: 'pin' | 'line' | 'polygon'
  latitude: number | null
  longitude: number | null
  geometry: GeoJSONGeometry | null
  category: string
  comment: string
  name: string | null
  votes: number
  createdAt: string
}

interface Overlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  rotation: number
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  allowPins: boolean
  allowDrawing: boolean
  overlays: Overlay[]
  pins: PublicPin[]
  // Styling customization
  embedPrimaryColor: string | null
  embedFontFamily: string | null
  embedHideStreetLabels: boolean
}

// Shape types for drawing
type DrawMode = 'pin' | 'polygon' | null

// Pending shape state
interface PendingShape {
  type: 'pin' | 'polygon'
  lat?: number
  lng?: number
  geometry?: GeoJSONGeometry
}

// Issue categories
const ISSUE_CATEGORIES = [
  { id: 'noise', label: 'Noise', icon: Volume2, color: '#EF4444', bg: '#FEF2F2' },
  { id: 'dust', label: 'Dust/Pollution', icon: Wind, color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'traffic', label: 'Traffic/Access', icon: Car, color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'damage', label: 'Property Damage', icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
  { id: 'safety', label: 'Safety Concern', icon: ShieldAlert, color: '#EF4444', bg: '#FEE2E2' },
  { id: 'hours', label: 'Working Hours', icon: Clock, color: '#6366F1', bg: '#E0E7FF' },
  { id: 'other', label: 'Other Issue', icon: HelpCircle, color: '#6B7280', bg: '#F3F4F6' },
]

export default function IssuesEmbedPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [selectedCategory, setSelectedCategory] = useState('noise')
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    comment: '',
    name: '',
    email: '',
    gdprConsent: false,
    mailingConsent: false,
  })

  // Default to roadmap (map view) so labels are visible
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap')
  const [votedPins, setVotedPins] = useState<Set<string>>(new Set())

  // Drag-to-drop marker state
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<EmbedMapHandle>(null)

  // Load voted pins from localStorage on mount
  useEffect(() => {
    const storageKey = `voted_pins_${params.id}_issues`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setVotedPins(new Set(parsed))
      } catch {
        // Invalid data, ignore
      }
    }
  }, [params.id])

  useEffect(() => {
    fetch(`/api/embed/${params.id}?mode=issues`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        setProject(data)
        setLoading(false)
      })
      .catch(err => {
        setError('This issue reporter is not available')
        setLoading(false)
      })
  }, [params.id])

  // Handle map click for pins
  const handleMapClick = (lat: number, lng: number) => {
    if (drawMode === 'pin') {
      setPendingShape({ type: 'pin', lat, lng })
      setShowForm(true)
      setDrawMode(null)
    }
  }

  // Handle shape completion (polygons)
  const handleShapeComplete = (geometry: GeoJSONGeometry, type: 'polygon') => {
    setPendingShape({ type, geometry })
    setShowForm(true)
    setDrawMode(null)
  }

  const handleSubmit = async () => {
    if (!pendingShape || !form.comment.trim() || !form.name.trim() || !form.email.trim() || !form.gdprConsent) return

    setSubmitting(true)
    try {
      let body: Record<string, unknown> = {
        mode: 'issues',
        shapeType: pendingShape.type,
        category: selectedCategory,
        comment: form.comment,
        name: form.name || null,
        email: form.email || null,
        gdprConsent: form.gdprConsent,
        mailingConsent: form.mailingConsent,
      }

      if (pendingShape.type === 'pin') {
        body.latitude = pendingShape.lat
        body.longitude = pendingShape.lng
      } else {
        body.geometry = pendingShape.geometry
      }

      const response = await fetch(`/api/embed/${params.id}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!response.ok) throw new Error('Failed to submit')

      const newPin = await response.json()
      setProject(prev => prev ? {
        ...prev,
        pins: [newPin, ...prev.pins]
      } : null)

      // Reset form
      cancelDrawing()
    } catch (err) {
      alert('Failed to submit your issue. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelDrawing = () => {
    setPendingShape(null)
    setShowForm(false)
    setDrawMode(null)
    setIsDragging(false)
    setDragPosition(null)
    setForm({ comment: '', name: '', email: '', gdprConsent: false, mailingConsent: false })
    setSelectedCategory('noise')
  }

  // Handle drag start for the marker
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setDragPosition({ x: clientX, y: clientY })
  }

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    setDragPosition({ x: clientX, y: clientY })
  }, [isDragging])

  // Handle drag end - convert screen position to map coordinates
  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !mapContainerRef.current) {
      setIsDragging(false)
      setDragPosition(null)
      return
    }

    const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX
    const clientY = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY

    // Check if drop is within the map container
    const mapRect = mapContainerRef.current.getBoundingClientRect()
    const isOverMap = (
      clientX >= mapRect.left &&
      clientX <= mapRect.right &&
      clientY >= mapRect.top &&
      clientY <= mapRect.bottom
    )

    if (isOverMap && mapRef.current) {
      const map = mapRef.current.getMapInstance()
      if (map) {
        // Convert screen coordinates to map coordinates using Google Maps projection
        const projection = map.getProjection()
        const bounds = map.getBounds()
        const topRight = projection?.fromLatLngToPoint(bounds?.getNorthEast() as google.maps.LatLng)
        const bottomLeft = projection?.fromLatLngToPoint(bounds?.getSouthWest() as google.maps.LatLng)

        if (topRight && bottomLeft) {
          const scale = Math.pow(2, map.getZoom() || 0)
          const mapWidth = mapRect.width
          const mapHeight = mapRect.height

          // Calculate the point in world coordinates
          const relX = (clientX - mapRect.left) / mapWidth
          const relY = (clientY - mapRect.top) / mapHeight

          const worldX = bottomLeft.x + relX * (topRight.x - bottomLeft.x)
          const worldY = topRight.y + relY * (bottomLeft.y - topRight.y)

          const worldPoint = new google.maps.Point(worldX, worldY)
          const latLng = projection?.fromPointToLatLng(worldPoint)

          if (latLng) {
            setPendingShape({ type: 'pin', lat: latLng.lat(), lng: latLng.lng() })
            setShowForm(true)
          }
        }
      }
    }

    setIsDragging(false)
    setDragPosition(null)
  }, [isDragging])

  // Set up global mouse/touch event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      window.addEventListener('touchmove', handleDragMove)
      window.addEventListener('touchend', handleDragEnd)

      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
        window.removeEventListener('touchmove', handleDragMove)
        window.removeEventListener('touchend', handleDragEnd)
      }
    }
  }, [isDragging, handleDragMove, handleDragEnd])

  const handleVote = async (pinId: string) => {
    if (!project) return

    if (votedPins.has(pinId)) {
      return
    }

    try {
      const response = await fetch(`/api/embed/${params.id}/pins/${pinId}/vote`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to vote')

      const { votes } = await response.json()

      setProject(prev => prev ? {
        ...prev,
        pins: prev.pins.map(p =>
          p.id === pinId ? { ...p, votes } : p
        )
      } : null)

      const newVotedPins = new Set(votedPins)
      newVotedPins.add(pinId)
      setVotedPins(newVotedPins)

      const storageKey = `voted_pins_${params.id}_issues`
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newVotedPins)))
    } catch (err) {
      console.error('Failed to vote:', err)
    }
  }

  const getDrawModeInstruction = () => {
    switch (drawMode) {
      case 'pin':
        return 'Click on the map to mark the issue location'
      case 'polygon':
        return 'Click to draw the affected area. Double-click to close.'
      default:
        return ''
    }
  }

  const getShapeLabel = () => {
    switch (pendingShape?.type) {
      case 'pin':
        return 'location'
      case 'polygon':
        return 'area'
      default:
        return 'issue'
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading issue reporter...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Issue Reporter Unavailable</h1>
          <p className="text-gray-500">{error || 'This issue reporter is not available'}</p>
        </div>
      </div>
    )
  }

  const center: [number, number] = [
    project.latitude || 51.5074,
    project.longitude || -0.1278
  ]

  // Get font URL for Google Fonts
  const fontFamily = project.embedFontFamily || 'DM Sans'
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`
  const primaryColor = project.embedPrimaryColor || '#EA580C' // Default orange for issues

  return (
    <>
      <link href={fontUrl} rel="stylesheet" />
      <style>{`
        :root {
          --embed-primary: ${primaryColor};
        }
        .bg-orange-600 { background-color: ${primaryColor} !important; }
        .bg-orange-700 { background-color: ${primaryColor} !important; filter: brightness(0.9); }
        .text-orange-600 { color: ${primaryColor} !important; }
        .border-orange-500 { border-color: ${primaryColor} !important; }
        .bg-orange-50 { background-color: ${primaryColor}15 !important; }
        .ring-orange-300 { --tw-ring-color: ${primaryColor}50 !important; }
        .focus\\:ring-orange-500:focus { --tw-ring-color: ${primaryColor} !important; }
        .focus\\:border-orange-500:focus { border-color: ${primaryColor} !important; }
      `}</style>
      <div className="h-screen w-screen relative overflow-hidden" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>
        {/* Map fills entire screen */}
        <div ref={mapContainerRef} className="h-full w-full">
        <EmbedMap
          ref={mapRef}
          center={center}
          zoom={project.mapZoom || 15}
          overlays={project.overlays}
          pins={project.pins}
          pendingPin={pendingShape?.type === 'pin' ? { lat: pendingShape.lat!, lng: pendingShape.lng! } : null}
          pendingShape={pendingShape && pendingShape.type === 'polygon' ? { type: pendingShape.type, geometry: pendingShape.geometry } : null}
          isAddingPin={drawMode === 'pin'}
          drawMode={drawMode}
          onMapClick={handleMapClick}
          onShapeComplete={handleShapeComplete}
          onVote={handleVote}
          mapType={mapType}
          votedPins={votedPins}
          mode="issues"
          hideStreetLabels={project.embedHideStreetLabels || false}
          primaryColor={primaryColor}
        />
        </div>

        {/* Draggable Issue Marker - Top Right */}
        {project.allowPins && !showForm && (
          <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-3">
            {/* Draggable marker */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="cursor-grab active:cursor-grabbing select-none"
              title="Drag to map to report an issue"
            >
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 flex items-center gap-3 hover:shadow-xl transition-shadow">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${primaryColor}20` }}
                >
                  <MapPin size={24} style={{ color: primaryColor }} />
                </div>
                <div className="pr-2">
                  <p className="font-semibold text-gray-900 text-sm">Report Issue</p>
                  <p className="text-xs text-gray-500">Drag to map</p>
                </div>
              </div>
            </div>

            {/* Mark affected area button */}
            {project.allowDrawing && (
              <button
                onClick={() => {
                  if (drawMode === 'polygon') {
                    cancelDrawing()
                  } else {
                    setDrawMode('polygon')
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium shadow-lg transition-all ${
                  drawMode === 'polygon'
                    ? 'text-white ring-2'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
                style={drawMode === 'polygon' ? { backgroundColor: primaryColor, '--tw-ring-color': `${primaryColor}80` } as React.CSSProperties : undefined}
              >
                <Pentagon size={18} />
                <span>Mark Area</span>
              </button>
            )}
          </div>
        )}

        {/* Instruction Banner */}
        {drawMode && !showForm && (
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white px-6 py-3 rounded-lg shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <p className="font-medium">{getDrawModeInstruction()}</p>
          </div>
        )}

        {/* Map Type Button */}
        <button
          onClick={() => setMapType(mapType === 'satellite' ? 'roadmap' : 'satellite')}
          className="absolute bottom-4 right-4 z-10 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg transition-colors"
          style={{ backgroundColor: primaryColor }}
          onMouseOver={(e) => { e.currentTarget.style.filter = 'brightness(0.9)' }}
          onMouseOut={(e) => { e.currentTarget.style.filter = '' }}
        >
          {mapType === 'satellite' ? 'Map' : 'Satellite'}
        </button>

        {/* Floating marker during drag */}
        {isDragging && dragPosition && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: dragPosition.x - 24,
              top: dragPosition.y - 48,
            }}
          >
            <svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="dragShadow" x="-30%" y="-20%" width="160%" height="150%">
                  <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.3"/>
                </filter>
              </defs>
              <g filter="url(#dragShadow)">
                <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill={primaryColor}/>
                <circle cx="24" cy="22" r="14" fill="white"/>
                <circle cx="24" cy="22" r="6" fill={primaryColor}/>
              </g>
            </svg>
          </div>
        )}

        {/* Issue Form Modal */}
        {showForm && pendingShape && (
          <div className="absolute inset-0 z-20 bg-black/30 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
              {/* Form Header */}
              <div
                className="text-white px-5 py-4 rounded-t-xl"
                style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryColor}dd)` }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Report an Issue</h2>
                  <button
                    onClick={cancelDrawing}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-white/70 text-sm mt-1">
                  Describe the issue at this {getShapeLabel()}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type of issue
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ISSUE_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                          selectedCategory === cat.id
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: cat.bg }}
                        >
                          <cat.icon size={16} style={{ color: cat.color }} />
                        </div>
                        <span className="font-medium text-gray-700 text-sm">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe the issue *
                  </label>
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder="Please describe the issue you're experiencing..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {form.comment.length}/2000
                  </p>
                </div>

                {/* Contact Details */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      maxLength={100}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      maxLength={255}
                      required
                    />
                  </div>
                </div>

                {/* Moderation Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Please note:</strong> All reports are reviewed before being published. Thank you for helping us monitor construction impacts.
                  </p>
                </div>

                {/* GDPR Consent */}
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div className="flex items-start gap-3">
                    <input
                      id="gdprConsent"
                      type="checkbox"
                      checked={form.gdprConsent}
                      onChange={e => setForm({ ...form, gdprConsent: e.target.checked })}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-600"
                    />
                    <label htmlFor="gdprConsent" className="text-xs text-gray-600">
                      I consent to my report being processed by the project team. *{' '}
                      <a href="/privacy" target="_blank" className="text-orange-600 hover:underline">
                        Privacy Policy
                      </a>
                    </label>
                  </div>

                  <div className="flex items-start gap-3">
                    <input
                      id="mailingConsent"
                      type="checkbox"
                      checked={form.mailingConsent}
                      onChange={e => setForm({ ...form, mailingConsent: e.target.checked })}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-600"
                    />
                    <label htmlFor="mailingConsent" className="text-xs text-gray-600">
                      I would like to receive updates about this project (optional)
                    </label>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={cancelDrawing}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!form.comment.trim() || !form.name.trim() || !form.email.trim() || !form.gdprConsent || submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: primaryColor }}
                    onMouseOver={(e) => { if (!submitting) e.currentTarget.style.filter = 'brightness(0.9)' }}
                    onMouseOut={(e) => { e.currentTarget.style.filter = '' }}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={18} /> Submit Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
