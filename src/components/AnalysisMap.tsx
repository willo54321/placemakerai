'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Circle, GeoJSON, Tooltip, useMap } from 'react-leaflet'
import type { SpatialInsight } from '@/lib/ai'

// Leaflet CSS is loaded dynamically at runtime to avoid conflicts with Google Maps

export const STANCE_COLORS: Record<string, string> = {
  positive: '#10b981',
  negative: '#ef4444',
  neutral: '#94a3b8',
  mixed: '#f59e0b',
}

export interface MapResponse {
  id: string
  latitude: number
  longitude: number
  sentiment: 'positive' | 'negative' | 'neutral' | null
}

interface AnalysisMapProps {
  responses: MapResponse[]
  insights: SpatialInsight[]
  selectedInsight: number | null
  onSelectInsight: (index: number | null) => void
  onSelectResponse?: (id: string) => void
  boundary?: unknown | null
  height?: string
}

/** Fit the viewport to the boundary + responses once per data change. */
function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView(points[0], 15)
      return
    }
    map.fitBounds(points, { padding: [30, 30] })
  }, [map, points])
  return null
}

/** Pan to a spatial insight when it's selected from the cards column. */
function FocusInsight({ insight }: { insight: SpatialInsight | null }) {
  const map = useMap()
  useEffect(() => {
    if (insight) {
      map.panTo([insight.latitude, insight.longitude])
    }
  }, [map, insight])
  return null
}

export function AnalysisMap({
  responses,
  insights,
  selectedInsight,
  onSelectInsight,
  onSelectResponse,
  boundary,
  height = '100%',
}: AnalysisMapProps) {
  const [cssLoaded, setCssLoaded] = useState(false)

  // Load Leaflet CSS dynamically at runtime to avoid conflicts with Google Maps
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = ''
      document.head.appendChild(link)
      link.onload = () => setCssLoaded(true)
    } else {
      setCssLoaded(true)
    }
  }, [])

  const fitPoints = useMemo(() => {
    const points: Array<[number, number]> = responses.map(r => [r.latitude, r.longitude])
    insights.forEach(insight => points.push([insight.latitude, insight.longitude]))
    return points
  }, [responses, insights])

  const selected = selectedInsight != null ? insights[selectedInsight] ?? null : null

  if (!cssLoaded) {
    return (
      <div style={{ height }} className="bg-slate-100 animate-pulse rounded-lg" />
    )
  }

  return (
    <MapContainer
      center={fitPoints[0] ?? [51.5074, -0.1278]}
      zoom={14}
      style={{ height, width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={fitPoints} />
      <FocusInsight insight={selected} />

      {Boolean(boundary) && (
        <GeoJSON
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={boundary as any}
          style={{ color: '#16A34A', weight: 2, dashArray: '6 4', fillOpacity: 0.04 }}
        />
      )}

      {/* Hotspot areas: one circle per significance-tested spatial finding.
          The circle covers the ~1km grid cell the statistics were run on. */}
      {insights.map((insight, index) => {
        const isSelected = index === selectedInsight
        const color = STANCE_COLORS[insight.dominantSentiment] || STANCE_COLORS.neutral
        return (
          <Circle
            key={`${insight.latitude},${insight.longitude},${insight.theme}`}
            center={[insight.latitude, insight.longitude]}
            radius={600}
            pathOptions={{
              color,
              weight: isSelected ? 3 : 1.5,
              dashArray: isSelected ? undefined : '4 4',
              fillColor: color,
              fillOpacity: isSelected ? 0.25 : 0.12,
            }}
            eventHandlers={{
              click: () => onSelectInsight(isSelected ? null : index),
            }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <div style={{ maxWidth: 220 }}>
                <strong>{insight.theme}</strong>
                <br />
                {insight.count} of {insight.areaTotal} responses around {insight.areaLabel}
              </div>
            </Tooltip>
          </Circle>
        )
      })}

      {responses.map(response => (
        <CircleMarker
          key={response.id}
          center={[response.latitude, response.longitude]}
          radius={4}
          pathOptions={{
            color: '#ffffff',
            weight: 1,
            fillColor: STANCE_COLORS[response.sentiment ?? 'neutral'],
            fillOpacity: 0.9,
          }}
          eventHandlers={
            onSelectResponse ? { click: () => onSelectResponse(response.id) } : undefined
          }
        />
      ))}
    </MapContainer>
  )
}
