'use client'

import { useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { TOUR_STOP_ICON_PATHS } from '@/lib/tour-icons'
import { tourStopPinUrl, planBadgeUrl } from '@/lib/map-pin-icons'

export interface MapKeyLayer {
  id: string
  name: string
  /** Swatch for a plan layer; null for a plain image. */
  color?: string | null
  /** Swatch edge when the layer's outline differs from its fill. */
  outline?: string | null
  /** How the layer draws on the map, so the swatch can match it. Default: an area. */
  kind?: 'polygon' | 'line' | 'point'
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  /** Shared marker glyph id (TOUR_STOP_ICON_PATHS). */
  icon?: string | null
}

/** The layer as it appears on the map: its pin, a stretch of its line (with badge), or an area. */
function Swatch({ layer }: { layer: MapKeyLayer }) {
  const color = layer.color ?? '#94a3b8'
  const glyph = layer.icon ? TOUR_STOP_ICON_PATHS[layer.icon] : undefined
  if (layer.kind === 'point') {
    return glyph
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={tourStopPinUrl(color, { iconPath: glyph })} alt="" className="w-5 h-6" />
      : <span className="w-3 h-3 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: color }} />
  }
  if (layer.kind === 'line') {
    const stroke = layer.outline || color
    return (
      <span className="relative w-9 h-5 flex items-center justify-center">
        <svg viewBox="0 0 36 6" className="absolute inset-x-0 w-9 h-1.5" aria-hidden="true">
          <line
            x1="2" y1="3" x2="34" y2="3" stroke={stroke} strokeWidth="3"
            strokeLinecap={layer.lineStyle === 'dotted' ? 'round' : 'butt'}
            strokeDasharray={layer.lineStyle === 'dashed' ? '5 3' : layer.lineStyle === 'dotted' ? '0.1 5' : undefined}
          />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {glyph && <img src={planBadgeUrl(stroke, glyph)} alt="" className="relative w-5 h-5" />}
      </span>
    )
  }
  return (
    <span
      className="w-4 h-4 rounded-sm border border-black/10"
      style={{
        backgroundColor: color,
        ...(layer.outline && layer.outline.toLowerCase() !== color.toLowerCase()
          ? { borderColor: layer.outline, borderWidth: 2 }
          : {}),
      }}
    />
  )
}

/**
 * Collapsible key of the plan layers on the map, each a toggle. Listed
 * top-most layer first, as a plan's own key does.
 */
export function MapKey({
  layers, hiddenIds, onToggle, className = '', defaultOpen = false,
}: {
  layers: MapKeyLayer[]
  hiddenIds: Set<string>
  onToggle: (id: string) => void
  className?: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (layers.length === 0) return null
  const hidden = layers.filter(l => hiddenIds.has(l.id)).length
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          Map key
          <span className="ml-2 normal-case tracking-normal font-normal text-gray-400">
            {hidden > 0 ? `${layers.length - hidden} of ${layers.length} shown` : `${layers.length} layers`}
          </span>
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-1.5 mt-3">
          {layers.slice().reverse().map(layer => {
            const shown = !hiddenIds.has(layer.id)
            return (
              <button
                key={layer.id}
                type="button"
                aria-pressed={shown}
                onClick={() => onToggle(layer.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-200 text-left transition-colors"
              >
                <span className="w-9 shrink-0 flex items-center justify-center transition-opacity" style={{ opacity: shown ? 1 : 0.25 }}>
                  <Swatch layer={layer} />
                </span>
                <span className={`flex-1 text-sm ${shown ? 'text-gray-900' : 'text-gray-400'}`}>{layer.name}</span>
                {shown ? <Eye size={14} className="text-gray-400" /> : <EyeOff size={14} className="text-gray-300" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
