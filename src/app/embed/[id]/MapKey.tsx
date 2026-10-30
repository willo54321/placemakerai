'use client'

import { useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'

export interface MapKeyLayer {
  id: string
  name: string
  /** Swatch for a plan layer; null for a plain image. */
  color?: string | null
  /** Swatch edge when the layer's outline differs from its fill. */
  outline?: string | null
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
                <span
                  className="w-4 h-4 rounded-sm shrink-0 border border-black/10 transition-opacity"
                  style={{
                    backgroundColor: layer.color ?? '#94a3b8',
                    opacity: shown ? 1 : 0.25,
                    ...(layer.outline && layer.outline.toLowerCase() !== layer.color?.toLowerCase()
                      ? { borderColor: layer.outline, borderWidth: 2 }
                      : {}),
                  }}
                />
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
