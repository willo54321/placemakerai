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

// Single-hue ramps that stay translucent: density reads through colour
// intensity while the basemap stays legible underneath. Never ramp to dark,
// opaque tones — that turns clusters into solid discs.
const POSITIVE_GRADIENT = [
  'rgba(16, 185, 129, 0)',
  'rgba(16, 185, 129, 0.35)',
  'rgba(16, 185, 129, 0.55)',
  'rgba(5, 150, 105, 0.72)',
  'rgba(4, 120, 87, 0.85)',
]

const NEGATIVE_GRADIENT = [
  'rgba(239, 68, 68, 0)',
  'rgba(239, 68, 68, 0.35)',
  'rgba(239, 68, 68, 0.55)',
  'rgba(220, 38, 38, 0.72)',
  'rgba(185, 28, 28, 0.85)',
]

// Quiet, desaturated basemap so the heat is the loudest thing on the map.
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { elementType: 'geometry', stylers: [{ saturation: -60 }, { lightness: 10 }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
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
      const weight = 0.65 + (cluster.count / maxCount) * 0.35
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
          styles: MAP_STYLES,
        }}
      >
        {showPositive && positivePoints.length > 0 && (
          <HeatmapLayerF
            data={positivePoints}
            options={{ gradient: POSITIVE_GRADIENT, radius: 46, maxIntensity: 1.1 }}
          />
        )}
        {showNegative && negativePoints.length > 0 && (
          <HeatmapLayerF
            data={negativePoints}
            options={{ gradient: NEGATIVE_GRADIENT, radius: 46, maxIntensity: 1.1 }}
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
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
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
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-700">Opposition</span>
              <span className="text-slate-400 text-xs">({negativeCount})</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
