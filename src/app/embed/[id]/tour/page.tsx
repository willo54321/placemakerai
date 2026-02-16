'use client'

import { useEffect, useState, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import dynamic from 'next/dynamic'
import { TourPlayer, StartTourButton } from '../TourPlayer'

const TourMap = dynamic(() => import('./TourMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="text-gray-500">Loading map...</div>
    </div>
  )
})

interface Overlay {
  id: string
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  opacity: number
  rotation: number
}

interface TourStop {
  id: string
  order: number
  title: string
  description: string
  imageUrl: string | null
  latitude: number
  longitude: number
  zoom: number
  highlight: unknown | null
  showOverlay: string | null
}

interface Tour {
  id: string
  name: string
  description: string | null
  stops: TourStop[]
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  latitude: number | null
  longitude: number | null
  mapZoom: number | null
  overlays: Overlay[]
  tour: Tour | null
}

export default function TourEmbedPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<ProjectData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Tour state
  const [isTourActive, setIsTourActive] = useState(false)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [mapZoom, setMapZoom] = useState<number | null>(null)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite')

  useEffect(() => {
    fetch(`/api/embed/${params.id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then(data => {
        setProject(data)
        setLoading(false)
      })
      .catch(err => {
        setError('This tour is not available')
        setLoading(false)
      })
  }, [params.id])

  // Tour navigation handler
  const handleTourNavigate = useCallback((lat: number, lng: number, zoom: number) => {
    setMapCenter({ lat, lng })
    setMapZoom(zoom)
  }, [])

  const handleTourClose = () => {
    setIsTourActive(false)
    setMapCenter(null)
    setMapZoom(null)
  }

  const handleStartTour = () => {
    setIsTourActive(true)
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500">Loading tour...</p>
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
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Tour Unavailable</h1>
          <p className="text-gray-500">{error || 'This tour is not available'}</p>
        </div>
      </div>
    )
  }

  if (!project.tour || project.tour.stops.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} className="text-gray-400" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">No Tour Available</h1>
          <p className="text-gray-500">This project doesn't have a tour set up yet</p>
        </div>
      </div>
    )
  }

  const center: [number, number] = [
    project.latitude || 51.5074,
    project.longitude || -0.1278
  ]

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div className="h-screen w-screen relative overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        {/* Map */}
        <TourMap
          center={mapCenter ? [mapCenter.lat, mapCenter.lng] : center}
          zoom={mapZoom || project.mapZoom || 15}
          overlays={project.overlays}
          mapType={mapType}
          animateToCenter={mapCenter !== null}
        />

        {/* Map Type Button - Bottom Right */}
        <button
          onClick={() => setMapType(mapType === 'satellite' ? 'roadmap' : 'satellite')}
          className="absolute bottom-4 right-4 z-10 bg-green-600 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg hover:bg-green-700 transition-colors"
        >
          {mapType === 'satellite' ? 'Map' : 'Satellite'}
        </button>

        {/* Tour Button - Bottom Left (when tour not active) */}
        {!isTourActive && (
          <div className="absolute bottom-4 left-4 z-10">
            <StartTourButton onClick={handleStartTour} />
          </div>
        )}

        {/* Tour Player */}
        {isTourActive && (
          <TourPlayer
            tour={project.tour}
            onNavigate={handleTourNavigate}
            onClose={handleTourClose}
          />
        )}
      </div>
    </>
  )
}
