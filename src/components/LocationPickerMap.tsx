'use client'

import { useCallback, useState } from 'react'
import { GoogleMap, useJsApiLoader, MarkerF } from '@react-google-maps/api'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry")[] = ['drawing', 'geometry']

interface LocationPickerMapProps {
  latitude: number | null
  longitude: number | null
  onLocationChange: (lat: number, lng: number) => void
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '256px',
}

const defaultCenter = {
  lat: 51.5074,
  lng: -0.1278,
}

// Hide large city/region labels but keep road names
const mapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: 'administrative.locality',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'administrative.province',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }]
  }
]

export default function LocationPickerMap({
  latitude,
  longitude,
  onLocationChange
}: LocationPickerMapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script-embed',  // Same ID as all other maps to avoid conflicts
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = useState<google.maps.Map | null>(null)

  const center = latitude && longitude
    ? { lat: latitude, lng: longitude }
    : defaultCenter

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map)
  }, [])

  const onUnmount = useCallback(() => {
    setMap(null)
  }, [])

  const handleClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      onLocationChange(e.latLng.lat(), e.latLng.lng())
    }
  }, [onLocationChange])

  // Handle API key not configured
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-lg p-4">
        <div className="text-center text-slate-500">
          <p className="font-medium">Google Maps API key not configured</p>
          <p className="text-sm mt-1">Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50 rounded-lg">
        <p className="text-red-600">Error loading map</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="animate-spin h-6 w-6 border-2 border-blue-600 rounded-full border-t-transparent" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={latitude ? 15 : 6}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onClick={handleClick}
      options={{
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
        mapTypeControl: true,
        mapTypeControlOptions: {
          style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
          position: google.maps.ControlPosition.TOP_RIGHT,
        },
        streetViewControl: false,
        fullscreenControl: true,
        fullscreenControlOptions: {
          position: google.maps.ControlPosition.RIGHT_TOP,
        },
        scaleControl: true,
        gestureHandling: 'greedy',
        styles: mapStyles,
      }}
    >
      {latitude && longitude && (
        <MarkerF
          position={{ lat: latitude, lng: longitude }}
        />
      )}
    </GoogleMap>
  )
}
