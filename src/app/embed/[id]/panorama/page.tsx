'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamic import for Marzipano viewer (browser-only)
const PanoramaViewer = dynamic(() => import('./PanoramaViewer'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-900">
      <div className="text-white">Loading panorama...</div>
    </div>
  )
})

interface PanoramaHotspot {
  id: string
  type: 'info' | 'link' | 'video' | 'image'
  yaw: number
  pitch: number
  title: string | null
  content: string | null
  icon: string | null
  targetId: string | null
  videoUrl: string | null
  imageUrl: string | null
}

interface Panorama {
  id: string
  name: string
  description: string | null
  imageUrl: string
  initialYaw: number
  initialPitch: number
  initialFov: number
  order: number
  hotspots: PanoramaHotspot[]
}

interface ProjectData {
  id: string
  name: string
  description: string | null
  embedPrimaryColor: string | null
  embedFontFamily: string | null
}

interface PanoramaData {
  project: ProjectData
  panoramas: Panorama[]
}

export default function PanoramaEmbedPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PanoramaData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPanoramaIndex, setCurrentPanoramaIndex] = useState(0)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/embed/${params.id}/panorama`)
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to load panorama')
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load panorama')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [params.id])

  const handleNavigateToPanorama = (panoramaId: string) => {
    if (!data) return
    const index = data.panoramas.findIndex(p => p.id === panoramaId)
    if (index !== -1) {
      setCurrentPanoramaIndex(index)
    }
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading panorama...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-2">Error</div>
          <div className="text-gray-400">{error}</div>
        </div>
      </div>
    )
  }

  if (!data || data.panoramas.length === 0) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">No panoramas available</div>
      </div>
    )
  }

  const { project, panoramas } = data
  const currentPanorama = panoramas[currentPanoramaIndex]
  const primaryColor = project.embedPrimaryColor || '#10B981'
  const fontFamily = project.embedFontFamily || 'DM Sans'
  const fontUrl = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;500;600;700&display=swap`

  return (
    <>
      {/* Google Fonts */}
      <link href={fontUrl} rel="stylesheet" />

      {/* Dynamic styles */}
      <style>{`
        :root {
          --embed-primary: ${primaryColor};
        }
        body {
          font-family: '${fontFamily}', sans-serif;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        .hotspot-marker {
          background: ${primaryColor};
        }
        .hotspot-marker:hover {
          transform: scale(1.1);
        }
        .panel-header {
          background: ${primaryColor};
        }
        .btn-primary {
          background: ${primaryColor};
        }
        .btn-primary:hover {
          filter: brightness(1.1);
        }
      `}</style>

      <div
        className="h-screen w-screen bg-gray-900"
        style={{ fontFamily: `'${fontFamily}', sans-serif` }}
      >
        <PanoramaViewer
          panorama={currentPanorama}
          panoramas={panoramas}
          primaryColor={primaryColor}
          onNavigateToPanorama={handleNavigateToPanorama}
        />
      </div>
    </>
  )
}
