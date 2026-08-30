'use client'

import { useCallback, useMemo, useState } from 'react'
import { GoogleMap, HeatmapLayerF, useJsApiLoader } from '@react-google-maps/api'

// Same key, id, version, and library set as every other map in the app —
// @react-google-maps/api requires identical loader options across components.
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry" | "visualization")[] = ['drawing', 'geometry', 'visualization']

interface SentimentCluster {
  latitude: number
  longitude: number
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  count: number
}

interface SentimentHeatmapProps {
  clusters: SentimentCluster[]
  height?: string
}

// Gradients run transparent → solid; Google interpolates between stops.
const POSITIVE_GRADIENT = [
  'rgba(34, 197, 94, 0)',
  'rgba(34, 197, 94, 0.5)',
  'rgba(22, 163, 74, 0.7)',
  'rgba(21, 128, 61, 0.85)',
  'rgba(22, 101, 52, 0.95)',
  'rgba(20, 83, 45, 1)',
]

const NEGATIVE_GRADIENT = [
  'rgba(248, 113, 113, 0)',
  'rgba(239, 68, 68, 0.5)',
  'rgba(220, 38, 38, 0.7)',
  'rgba(185, 28, 28, 0.85)',
  'rgba(153, 27, 27, 0.95)',
  'rgba(127, 29, 29, 1)',
]

export function SentimentHeatmap({ clusters, height = '400px' }: SentimentHeatmapProps) {
  const [showPositive, setShowPositive] = useState(true)
  const [showNegative, setShowNegative] = useState(true)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed', // Same ID as all other maps to avoid conflicts
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    version: '3.64', // DrawingManager was removed from the Maps JS API in 3.65
    libraries: LIBRARIES,
  })

  // Weighted heat points per stance. Mixed clusters feed both layers at
  // reduced weight. Weight floor keeps small clusters visible.
  const { positivePoints, negativePoints } = useMemo(() => {
    if (!isLoaded) return { positivePoints: [], negativePoints: [] }

    const maxCount = Math.max(...clusters.map(c => c.count), 1)
    const positive: google.maps.visualization.WeightedLocation[] = []
    const negative: google.maps.visualization.WeightedLocation[] = []

    clusters.forEach(cluster => {
      const weight = 0.5 + (cluster.count / maxCount) * 0.5
      const location = new google.maps.LatLng(cluster.latitude, cluster.longitude)

      if (cluster.sentiment === 'positive') {
        positive.push({ location, weight })
      } else if (cluster.sentiment === 'negative') {
        negative.push({ location, weight })
      } else if (cluster.sentiment === 'mixed') {
        positive.push({ location, weight: weight * 0.7 })
        negative.push({ location, weight: weight * 0.7 })
      }
    })

    return { positivePoints: positive, negativePoints: negative }
  }, [clusters, isLoaded])

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (clusters.length === 0) return
      const bounds = new google.maps.LatLngBounds()
      clusters.forEach(c => bounds.extend({ lat: c.latitude, lng: c.longitude }))
      map.fitBounds(bounds, 40)
    },
    [clusters]
  )

  const positiveCount = clusters
    .filter(c => c.sentiment === 'positive' || c.sentiment === 'mixed')
    .reduce((sum, c) => sum + c.count, 0)
  const negativeCount = clusters
    .filter(c => c.sentiment === 'negative' || c.sentiment === 'mixed')
    .reduce((sum, c) => sum + c.count, 0)

  if (!isLoaded) {
    return (
      <div style={{ height }} className="relative">
        <div className="h-full bg-slate-100 rounded-xl animate-pulse flex items-center justify-center">
          <p className="text-slate-500 text-sm">Loading heatmap...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height }} className="relative">
      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%', borderRadius: '12px' }}
        center={{ lat: clusters[0]?.latitude ?? 51.5074, lng: clusters[0]?.longitude ?? -0.1278 }}
        zoom={14}
        onLoad={onLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        }}
      >
        {showPositive && positivePoints.length > 0 && (
          <HeatmapLayerF
            data={positivePoints}
            options={{ gradient: POSITIVE_GRADIENT, radius: 35, opacity: 0.8 }}
          />
        )}
        {showNegative && negativePoints.length > 0 && (
          <HeatmapLayerF
            data={negativePoints}
            options={{ gradient: NEGATIVE_GRADIENT, radius: 35, opacity: 0.8 }}
          />
        )}
      </GoogleMap>

      {/* Legend & Controls */}
      <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-lg p-4 text-sm z-10">
        <p className="font-semibold text-slate-900 mb-3">Sentiment Layers</p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showPositive}
              onChange={(e) => setShowPositive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-emerald-200 to-emerald-700" />
              <span className="text-slate-700">Support</span>
              <span className="text-slate-400 text-xs">({positiveCount})</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={showNegative}
              onChange={(e) => setShowNegative(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gradient-to-r from-red-200 to-red-700" />
              <span className="text-slate-700">Opposition</span>
              <span className="text-slate-400 text-xs">({negativeCount})</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
