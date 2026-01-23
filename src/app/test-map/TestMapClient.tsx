'use client'

// This is a COPY of the exact pattern from EmbedMap that works
import { useCallback, useState } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry")[] = ['drawing', 'geometry']

export default function TestMapClient() {
  // Exact same loader pattern as EmbedMap
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script-embed',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)

  const onLoad = useCallback((map: google.maps.Map) => {
    map.setCenter({ lat: 51.5074, lng: -0.1278 })
    map.setZoom(12)
    map.setMapTypeId('roadmap')
    setMap(map)
    console.log('Map loaded via React wrapper')
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const apiKeyPreview = GOOGLE_MAPS_API_KEY
    ? `${GOOGLE_MAPS_API_KEY.substring(0, 10)}...${GOOGLE_MAPS_API_KEY.substring(GOOGLE_MAPS_API_KEY.length - 4)}`
    : 'NOT SET'

  if (!isLoaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Map Test - React Wrapper (like EmbedMap)</h1>
        <div className="mb-4 p-4 bg-gray-100 rounded text-sm font-mono">
          <p><strong>API Key:</strong> {apiKeyPreview}</p>
          <p><strong>isLoaded:</strong> NO</p>
        </div>
        <div className="h-96 flex items-center justify-center bg-gray-100">
          Loading map...
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Map Test - React Wrapper (like EmbedMap)</h1>

      <div className="mb-4 p-4 bg-gray-100 rounded text-sm font-mono">
        <p><strong>API Key:</strong> {apiKeyPreview}</p>
        <p><strong>isLoaded:</strong> YES</p>
        <p><strong>Map instance:</strong> {map ? 'Created' : 'Not created'}</p>
      </div>

      <p className="mb-4">This uses the exact same React wrapper as EmbedMap.</p>

      <div style={{ width: '100%', height: '500px', border: '2px solid blue' }}>
        <GoogleMap
          mapContainerStyle={{ height: '100%', width: '100%' }}
          center={{ lat: 51.5074, lng: -0.1278 }}
          zoom={12}
          mapTypeId="roadmap"
          options={{
            mapTypeId: 'roadmap',
            disableDefaultUI: false
          }}
          onLoad={onLoad}
          onUnmount={onUnmount}
        />
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Check browser console for errors.
      </p>
    </div>
  )
}
