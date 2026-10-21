'use client'

import { useEffect } from 'react'
import { RotatableOverlay } from './RotatableOverlay'

/** An image overlay (masterplan, site plan) drawn on a read-only map for context. */
export interface MapImageOverlay {
  id: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  rotation: number
  opacity: number
}

/** A project's image overlays as stored, reduced to the visible ones. */
export function toMapImageOverlays(
  rows: Array<{
    id: string; imageUrl: string; visible: boolean; opacity: number; rotation: number | null
    southLat: number; westLng: number; northLat: number; eastLng: number
  }> | null | undefined
): MapImageOverlay[] {
  return (rows ?? []).filter(o => o.visible).map(o => ({
    id: o.id,
    imageUrl: o.imageUrl,
    bounds: [[o.southLat, o.westLng], [o.northLat, o.eastLng]],
    rotation: o.rotation || 0,
    opacity: o.opacity,
  }))
}

/**
 * Draw image overlays on a map, non-interactive, removing them when the map
 * or the overlays change. `opacity` overrides each overlay's own setting.
 */
export function useImageOverlays(map: google.maps.Map | null, overlays: MapImageOverlay[], opacity?: number) {
  useEffect(() => {
    if (!map) return
    const drawn = overlays.map(o => {
      const overlay = new RotatableOverlay({
        imageUrl: o.imageUrl, bounds: o.bounds, rotation: o.rotation, opacity: opacity ?? o.opacity, clickable: false,
      })
      overlay.setMap(map)
      return overlay
    })
    return () => drawn.forEach(o => o.setMap(null))
  }, [map, overlays, opacity])
}
