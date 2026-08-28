'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, ThumbsUp, ThumbsDown, X, Send, MapPin, ChevronLeft, ChevronRight, Lightbulb, Pentagon, CheckCircle, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

const EmbedMap = dynamic(() => import('./EmbedMap'), {
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
  embedReferenceOnly: boolean
  embedDefaultSatellite: boolean
}

// Shape types for drawing
type DrawMode = 'pin' | 'polygon' | null

// Pending shape state
interface PendingShape {
  type: 'pin' | 'polygon'
  // For pin
  lat?: number
  lng?: number
  // For polygon - GeoJSON geometry
  geometry?: GeoJSONGeometry
}

const CATEGORIES = [
  { id: 'question', label: 'An idea or question', icon: Lightbulb, color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'negative', label: 'Negative', icon: ThumbsDown, color: '#EF4444', bg: '#FEE2E2' },
  { id: 'positive', label: 'Positive', icon: ThumbsUp, color: '#10B981', bg: '#D1FAE5' },
  { id: 'comment', label: 'Comment', icon: MessageCircle, color: '#6366F1', bg: '#E0E7FF' },
]

export default function EmbedPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>(null)
  const [pendingShape, setPendingShape] = useState<PendingShape | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [selectedCategory, setSelectedCategory] = useState('question')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [form, setForm] = useState({
    comment: '',
    name: '',
    email: '',
    gdprConsent: false,
  })

  // UI state - start collapsed on small screens so the sidebar doesn't cover
  // the top-right action buttons in narrow iframes (initialized on mount).
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [categoryFilters, setCategoryFilters] = useState<Record<string, boolean>>({
    question: true,
    negative: true,
    positive: true,
    comment: true,
  })
  // Map type - will be set when project loads based on embedDefaultSatellite setting
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | null>(null)
  const [votedPins, setVotedPins] = useState<Set<string>>(new Set())

  // Coarse (touch) pointer detection for touch-appropriate draw copy
  const [isCoarsePointer, setIsCoarsePointer] = useState(false)

  // Collapse the sidebar by default on small screens (narrow iframes)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(max-width: 640px)').matches) {
        setSidebarCollapsed(true)
      }
      setIsCoarsePointer(window.matchMedia('(pointer: coarse)').matches)
    }
  }, [])

  // Load voted pins from localStorage on mount
  useEffect(() => {
    const storageKey = `voted_pins_${params.id}`
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
    fetch(`/api/embed/${params.id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        setProject(data)
        // Set default map type based on project setting
        setMapType(data.embedDefaultSatellite ? 'satellite' : 'roadmap')
        setLoading(false)
      })
      .catch(err => {
        setError('This map is not available')
        setLoading(false)
      })
  }, [params.id])

  // Exit draw mode on Escape (only while drawing and the form isn't open)
  useEffect(() => {
    if (!drawMode || showForm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawMode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawMode, showForm])

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
    if (!pendingShape || !form.comment.trim() || !form.gdprConsent) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      let body: Record<string, unknown> = {
        shapeType: pendingShape.type,
        category: selectedCategory,
        comment: form.comment,
        name: form.name || null,
        email: form.email || null,
        gdprConsent: form.gdprConsent,
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

      // Consume the response so the request completes, but do NOT add the
      // pin to the visible map: submissions are moderated and would otherwise
      // appear published, then vanish on reload (looking like deletion).
      await response.json().catch(() => null)

      // Show an explicit success state instead of silently closing.
      setPendingShape(null)
      setDrawMode(null)
      setSubmitSuccess(true)
    } catch (err) {
      // Inline error (window.alert is blocked in cross-origin iframes).
      setSubmitError('Failed to submit your feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelDrawing = () => {
    setPendingShape(null)
    setShowForm(false)
    setDrawMode(null)
    setSubmitError(null)
    setSubmitSuccess(false)
    setForm({ comment: '', name: '', email: '', gdprConsent: false })
    setSelectedCategory('question')
  }

  const handleVote = async (pinId: string) => {
    if (!project) return

    // Check if already voted
    if (votedPins.has(pinId)) {
      return // Already voted, silently ignore
    }

    try {
      const response = await fetch(`/api/embed/${params.id}/pins/${pinId}/vote`, {
        method: 'POST'
      })

      if (!response.ok) throw new Error('Failed to vote')

      const { votes } = await response.json()

      // Update local state with new vote count
      setProject(prev => prev ? {
        ...prev,
        pins: prev.pins.map(p =>
          p.id === pinId ? { ...p, votes } : p
        )
      } : null)

      // Save voted pin to localStorage
      const newVotedPins = new Set(votedPins)
      newVotedPins.add(pinId)
      setVotedPins(newVotedPins)

      const storageKey = `voted_pins_${params.id}`
      localStorage.setItem(storageKey, JSON.stringify(Array.from(newVotedPins)))
    } catch (err) {
      console.error('Failed to vote:', err)
      // Surface a brief inline error instead of failing silently.
      setVoteError('Could not register your vote. Please try again.')
      window.setTimeout(() => setVoteError(null), 4000)
    }
  }

  const toggleCategoryFilter = (categoryId: string) => {
    setCategoryFilters(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }))
  }

  const getCategoryCount = (categoryId: string) => {
    if (!project) return 0
    return project.pins.filter(p => p.category === categoryId).length
  }

  const filteredPins = project?.pins.filter(p => categoryFilters[p.category] !== false) || []

  // Get instruction text based on draw mode (touch-appropriate copy on coarse pointers)
  const getDrawModeInstruction = () => {
    switch (drawMode) {
      case 'pin':
        return isCoarsePointer ? 'Tap on the map to place your pin' : 'Click on the map to place your pin'
      case 'polygon':
        return isCoarsePointer
          ? 'Tap points to draw an area, then tap the first point to finish'
          : 'Click to draw an area. Double-click to close the shape.'
      default:
        return ''
    }
  }

  // Get shape type label for form
  const getShapeLabel = () => {
    switch (pendingShape?.type) {
      case 'pin':
        return 'pin'
      case 'polygon':
        return 'area'
      default:
        return 'feedback'
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading consultation map...</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Map Unavailable</h1>
          <p className="text-gray-500">{error || 'This consultation map is not available'}</p>
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
  const primaryColor = project.embedPrimaryColor || '#10B981'

  return (
    <>
      <link href={fontUrl} rel="stylesheet" />
      <style>{`
        :root {
          --embed-primary: ${primaryColor};
        }
        .bg-brand-600 { background-color: ${primaryColor} !important; }
        .bg-brand-700 { background-color: ${primaryColor} !important; filter: brightness(0.9); }
        .text-brand-600 { color: ${primaryColor} !important; }
        .border-brand-500 { border-color: ${primaryColor} !important; }
        .bg-brand-50 { background-color: ${primaryColor}15 !important; }
        .ring-brand-300 { --tw-ring-color: ${primaryColor}50 !important; }
        .focus\\:ring-brand-500:focus { --tw-ring-color: ${primaryColor} !important; }
        .focus\\:border-brand-500:focus { border-color: ${primaryColor} !important; }
      `}</style>
      <div className="h-screen w-screen relative overflow-hidden" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>
        {/* Map fills entire screen */}
        <EmbedMap
          center={center}
          zoom={project.mapZoom || 15}
          overlays={project.overlays}
          pins={filteredPins}
          pendingPin={pendingShape?.type === 'pin' ? { lat: pendingShape.lat!, lng: pendingShape.lng! } : null}
          pendingShape={pendingShape && pendingShape.type === 'polygon' ? { type: pendingShape.type, geometry: pendingShape.geometry } : null}
          isAddingPin={drawMode === 'pin'}
          drawMode={drawMode}
          onMapClick={handleMapClick}
          onShapeComplete={handleShapeComplete}
          onVote={handleVote}
          mapType={mapType || 'satellite'}
          votedPins={votedPins}
          hideStreetLabels={project.embedHideStreetLabels || false}
          primaryColor={project.embedPrimaryColor || undefined}
        />

        {/* Feedback Buttons - Top Right (only if pins or drawing allowed and not reference mode) */}
        {!project.embedReferenceOnly && (project.allowPins || project.allowDrawing) && (
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            {/* Add Pin Button */}
            {project.allowPins && (
              <button
                onClick={() => {
                  if (drawMode === 'pin') {
                    cancelDrawing()
                  } else {
                    setDrawMode('pin')
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium shadow-lg transition-all ${
                  drawMode === 'pin'
                    ? 'bg-brand-700 text-white ring-2 ring-brand-300'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <MapPin size={18} />
                <span>Add Pin</span>
              </button>
            )}

            {/* Draw Area Button */}
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
                    ? 'bg-brand-700 text-white ring-2 ring-brand-300'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <Pentagon size={18} />
                <span>Draw Area</span>
              </button>
            )}
          </div>
        )}

        {/* Instruction Banner - Top Center (when drawing) */}
        {drawMode && !showForm && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-brand-600 text-white pl-6 pr-3 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-[calc(100vw-2rem)]">
            <p className="font-medium text-sm">{getDrawModeInstruction()}</p>
            <button
              onClick={() => setDrawMode(null)}
              aria-label="Cancel drawing"
              className="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}

        {/* Vote error toast */}
        {voteError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} /> {voteError}
          </div>
        )}

        {/* Left Sidebar (hidden in reference mode) */}
        {!project.embedReferenceOnly && (
        <div className={`absolute top-4 left-4 z-10 transition-all duration-300 ${sidebarCollapsed ? 'w-auto' : 'w-80'}`}>
          {/* Sidebar Header */}
          <div className={`bg-brand-600 p-4 flex items-start justify-between ${sidebarCollapsed ? 'rounded-xl' : 'rounded-t-xl'}`}>
            {!sidebarCollapsed && (
              <div className="text-white flex-1 mr-3">
                <h2 className="font-bold text-lg">Feedback Map</h2>
                <p className="text-brand-200 text-sm mt-1">
                  Click feedback to view details or add your own.
                </p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 bg-brand-500/50 hover:bg-brand-500 rounded-lg transition-colors text-white shrink-0"
            >
              {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Sidebar Content */}
          {!sidebarCollapsed && (
            <div className="bg-white rounded-b-xl shadow-lg max-h-[calc(100vh-6rem)] overflow-y-auto">
              <div className="p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Categories
                </p>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => {
                    const count = getCategoryCount(cat.id)
                    const isEnabled = categoryFilters[cat.id]
                    return (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: cat.bg }}
                          >
                            <cat.icon size={20} style={{ color: cat.color }} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{cat.label}</p>
                            <p className="text-xs text-gray-400">{count} item{count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        {/* Toggle Switch */}
                        <button
                          onClick={() => toggleCategoryFilter(cat.id)}
                          className={`relative w-12 h-7 rounded-full transition-colors ${
                            isEnabled ? 'bg-brand-500' : 'bg-gray-200'
                          }`}
                        >
                          <div
                            className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                              isEnabled ? 'left-6' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        {/* Map Type Button - Bottom Right */}
        {mapType && (
          <button
            onClick={() => setMapType(mapType === 'satellite' ? 'roadmap' : 'satellite')}
            className="absolute bottom-4 right-4 z-10 bg-brand-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg hover:bg-brand-700 transition-colors"
          >
            {mapType === 'satellite' ? 'Map' : 'Satellite'}
          </button>
        )}

        {/* Success Confirmation Panel */}
        {showForm && submitSuccess && (
          <div className="absolute inset-0 z-20 bg-black/30 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Thank you</h2>
              <p className="text-gray-600 mb-6">
                Your feedback has been received and will appear on the map once it has been reviewed.
              </p>
              <button
                onClick={cancelDrawing}
                className="w-full px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Feedback Form Modal */}
        {showForm && !submitSuccess && pendingShape && (
          <div className="absolute inset-0 z-20 bg-black/30 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-auto">
              {/* Form Header */}
              <div className="bg-gradient-to-r from-brand-600 to-brand-600 text-white px-5 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Leave Feedback</h2>
                  <button
                    onClick={cancelDrawing}
                    className="p-1 hover:bg-white/20 rounded transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-brand-200 text-sm mt-1">
                  Share your thoughts about this {getShapeLabel()}
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type of feedback
                  </label>
                  <div className="space-y-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                          selectedCategory === cat.id
                            ? 'border-brand-500 bg-brand-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: cat.bg }}
                        >
                          <cat.icon size={20} style={{ color: cat.color }} />
                        </div>
                        <span className="font-medium text-gray-700">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Your comment *
                  </label>
                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    placeholder={`What would you like to share about this ${getShapeLabel()}?`}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
                    rows={4}
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {form.comment.length}/2000
                  </p>
                </div>

                {/* Optional Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name (optional)
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      maxLength={255}
                    />
                  </div>
                </div>

                {/* Moderation Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Please note:</strong> All comments are moderated before being published. There may be a short delay between submitting your feedback and it appearing on the map.
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
                      className="mt-1 w-4 h-4 text-brand-600 border-gray-300 rounded focus:ring-brand-600"
                    />
                    <label htmlFor="gdprConsent" className="text-xs text-gray-600">
                      I consent to my feedback being displayed publicly and processed by the project team. *{' '}
                      <a href="/privacy" target="_blank" className="text-brand-600 hover:underline">
                        Privacy Policy
                      </a>
                    </label>
                  </div>
                </div>

                {/* Inline submit error (window.alert is blocked in iframes) */}
                {submitError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

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
                    disabled={!form.comment.trim() || !form.gdprConsent || submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={18} /> Submit
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
