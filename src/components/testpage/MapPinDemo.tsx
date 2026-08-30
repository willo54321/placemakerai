'use client'

import { useEffect, useRef, useState } from 'react'
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api'
import { ThumbsUp } from 'lucide-react'

/**
 * The Interactive Maps service demo: a scripted, looping re-enactment of the
 * real embed flow — cursor drops a pin, picks a category, writes a comment,
 * submits, sees the moderation thank-you — over a real Google Maps base,
 * using the actual product's categories, copy and colours. All movement rides
 * Stripe's marketing easing (easeOutExpo) as real DOM animation, no video.
 *
 * The choreography lives on a fixed 480x360 stage scaled to the container, so
 * every waypoint lands exactly at any viewport width. The map itself renders
 * unscaled underneath for crisp tiles; if Maps can't load, a schematic SVG
 * stands in.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'
const STAGE_W = 480
const STAGE_H = 360

// Open countryside near Aylesbury — deliberately unconnected to any client
// scheme, so the fictional demo comment can't be read as real feedback.
const MAP_CENTER = { lat: 51.846, lng: -0.856 }

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
const LIBRARIES: ("drawing" | "geometry" | "visualization")[] = ['drawing', 'geometry', 'visualization']

const COMMENT = 'Please keep the mature oaks along this footpath — they screen the whole close.'
const NAME = 'Margaret H.'

// Real embed categories (src/app/embed/[id]/page.tsx)
const CATEGORIES = [
  { id: 'question', label: 'An idea or question', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 'negative', label: 'Negative', color: '#EF4444', bg: '#FEE2E2' },
  { id: 'positive', label: 'Positive', color: '#10B981', bg: '#D1FAE5' },
  { id: 'comment', label: 'Comment', color: '#6366F1', bg: '#E0E7FF' },
]

const PIN = { x: 158, y: 168 } // where the pin lands, on the 480x360 stage

type Phase =
  | 'idle' | 'moving' | 'dropped' | 'category' | 'typing'
  | 'naming' | 'submitting' | 'thanks' | 'rest'

export default function MapPinDemo() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [typed, setTyped] = useState('')
  const [typedName, setTypedName] = useState('')
  const [clicking, setClicking] = useState(false)
  const [scale, setScale] = useState(1)
  const [reduced, setReduced] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const { isLoaded: mapReady } = useJsApiLoader({
    id: 'google-map-script-embed', // Same ID as all other maps to avoid conflicts
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    version: '3.64', // DrawingManager was removed from the Maps JS API in 3.65
    libraries: LIBRARIES,
  })

  const at = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms))
  }

  const clickAt = (ms: number) => {
    at(ms, () => setClicking(true))
    at(ms + 220, () => setClicking(false))
  }

  // Keep the stage scaled to the container width.
  useEffect(() => {
    const node = containerRef.current
    if (!node) return
    const update = () => setScale(node.clientWidth / STAGE_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true)
      setPhase('rest')
      setTyped(COMMENT)
      setTypedName(NAME)
      return
    }

    const node = containerRef.current
    if (!node) return

    let cancelled = false

    const runTimeline = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setTyped('')
      setTypedName('')
      setPhase('idle')

      at(400, () => setPhase('moving'))
      clickAt(1650)
      at(1700, () => setPhase('dropped'))
      at(2500, () => setPhase('category'))
      clickAt(3050)
      at(3300, () => setPhase('typing'))
      at(3450, () => {
        let i = 0
        const typer = setInterval(() => {
          i++
          setTyped(COMMENT.slice(0, i))
          if (i >= COMMENT.length) clearInterval(typer)
        }, 34)
        timers.current.push(typer as unknown as ReturnType<typeof setTimeout>)
      })
      at(6400, () => setPhase('naming'))
      at(6500, () => {
        let i = 0
        const typer = setInterval(() => {
          i++
          setTypedName(NAME.slice(0, i))
          if (i >= NAME.length) clearInterval(typer)
        }, 55)
        timers.current.push(typer as unknown as ReturnType<typeof setTimeout>)
      })
      at(7500, () => setPhase('submitting'))
      clickAt(8150)
      at(8350, () => setPhase('thanks'))
      at(10200, () => setPhase('rest'))
      at(13800, runTimeline) // loop
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          runTimeline()
          observer.disconnect()
        }
      },
      { threshold: 0.4 }
    )
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
      timers.current.forEach(clearTimeout)
    }
  }, [])

  const formOpen = ['dropped', 'category', 'typing', 'naming', 'submitting'].includes(phase)
  const pinDown = formOpen || phase === 'thanks' || phase === 'rest'
  const positiveSelected = ['typing', 'naming', 'submitting', 'thanks', 'rest'].includes(phase)

  // Cursor waypoints per phase, on the 480x360 stage. The form sits at
  // right:14 width:200 → content x 278-454. Rows from the top: title (~y47),
  // category chips row 1 (y~47-66: question | negative), row 2 (y~70-90:
  // POSITIVE | comment), comment box (y~98-153), name (y~159-177),
  // submit (y~186-206). The cursor tip is the transform origin.
  const cursor: Record<Phase, { x: number; y: number; visible: boolean }> = {
    idle: { x: 450, y: 344, visible: true },
    moving: { x: PIN.x + 4, y: PIN.y + 4, visible: true },
    dropped: { x: PIN.x + 4, y: PIN.y + 4, visible: true },
    category: { x: 316, y: 78, visible: true }, // centre of the Positive chip
    typing: { x: 336, y: 118, visible: true },
    naming: { x: 330, y: 166, visible: true },
    submitting: { x: 362, y: 194, visible: true },
    thanks: { x: 440, y: 335, visible: false },
    rest: { x: 440, y: 335, visible: false },
  }
  const c = cursor[phase]

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/3] w-full rounded-lg overflow-hidden border border-white/10 select-none"
      style={{ background: '#F1F3F4' }}
      aria-label="Demo: dropping a pin on the map and leaving a comment"
    >
      {/* Real Google Maps base — crisp, unscaled; schematic fallback below */}
      {mapReady && GOOGLE_MAPS_API_KEY ? (
        <div className="absolute inset-0">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={MAP_CENTER}
            zoom={16}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'none',
              clickableIcons: false,
              keyboardShortcuts: false,
            }}
          />
        </div>
      ) : (
        <svg viewBox="0 0 460 345" className="absolute inset-0 w-full h-full" aria-hidden="true">
          <rect width="460" height="345" fill="#F1F3F4" />
          <path d="M70 60 L210 40 L250 120 L190 200 L84 190 Z" fill="#CEEAD6" />
          <path d="M330 250 Q380 235 460 255 L460 345 L305 345 Q315 290 330 250 Z" fill="#AADAFF" opacity="0.7" />
          <g fill="#E8EAED">
            <rect x="252" y="52" width="46" height="30" rx="2" />
            <rect x="308" y="46" width="38" height="42" rx="2" />
            <rect x="360" y="60" width="52" height="34" rx="2" />
            <rect x="250" y="140" width="40" height="28" rx="2" />
            <rect x="60" y="238" width="44" height="30" rx="2" />
            <rect x="118" y="246" width="36" height="26" rx="2" />
            <rect x="190" y="242" width="48" height="30" rx="2" />
          </g>
          <g strokeLinecap="round" fill="none">
            <path d="M0 222 L460 208" stroke="#DADCE0" strokeWidth="13" />
            <path d="M0 222 L460 208" stroke="#FFFFFF" strokeWidth="10" />
            <path d="M228 0 L236 120 L230 345" stroke="#DADCE0" strokeWidth="11" />
            <path d="M228 0 L236 120 L230 345" stroke="#FFFFFF" strokeWidth="8" />
            <path d="M0 120 L96 128 L228 118" stroke="#DADCE0" strokeWidth="9" />
            <path d="M0 120 L96 128 L228 118" stroke="#FFFFFF" strokeWidth="6.5" />
          </g>
          <g fill="#70757A" fontSize="8.5" fontFamily="system-ui">
            <text x="292" y="218" transform="rotate(-1.5 292 218)">Meadow Lane</text>
            <text x="150" y="115" transform="rotate(3 150 115)">Willow Close</text>
          </g>
        </svg>
      )}

      {/* Choreography stage: fixed 480x360, scaled to fit */}
      <div
        className="absolute top-0 left-0 z-10"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none',
        }}
      >
        {/* click ripple */}
        {phase === 'dropped' && (
          <span
            className="absolute pin-ripple rounded-full border-2"
            style={{ left: PIN.x, top: PIN.y, borderColor: '#16A34A', transform: 'translate(-50%, -50%)' }}
          />
        )}

        {/* The pin */}
        {pinDown && (
          <div
            className="absolute pin-drop"
            style={{ left: PIN.x, top: PIN.y, transform: 'translate(-50%, -100%)' }}
          >
            <svg width="26" height="34" viewBox="0 0 26 34" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))' }}>
              <path
                d="M13 0C5.8 0 0 5.8 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 5.8 20.2 0 13 0Z"
                fill={phase === 'rest' || phase === 'thanks' ? '#10B981' : '#16A34A'}
              />
              <circle cx="13" cy="12.5" r="5" fill="#fff" />
            </svg>
          </div>
        )}

        {/* Feedback form — the real embed's copy and categories */}
        <div
          className="absolute w-[200px] bg-white rounded-xl shadow-2xl p-3 origin-top-right"
          style={{
            top: 14,
            right: 14,
            transition: `opacity 0.45s ${EASE}, transform 0.45s ${EASE}`,
            opacity: formOpen ? 1 : 0,
            transform: formOpen ? 'scale(1)' : 'scale(0.92) translateY(-4px)',
          }}
        >
          <p className="text-[10px] font-semibold text-slate-800 mb-2">
            Share your thoughts about this location
          </p>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {CATEGORIES.map(cat => {
              const selected = cat.id === 'positive' && positiveSelected
              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-1 rounded-md px-1.5 py-1 border"
                  style={{
                    transition: `all 0.3s ${EASE}`,
                    backgroundColor: selected ? cat.bg : '#fff',
                    borderColor: selected ? cat.color : '#e2e8f0',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-[8px] text-slate-600 truncate">{cat.label}</span>
                </div>
              )
            })}
          </div>
          <div className="rounded-md border border-slate-200 p-1.5 min-h-[52px] mb-1.5">
            <p className="text-[9px] text-slate-700 leading-snug">
              {typed || <span className="text-slate-300">What would you like to share about this location?</span>}
              {phase === 'typing' && <span className="demo-caret" />}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 px-1.5 py-1 mb-2">
            <p className="text-[9px] text-slate-700">
              {typedName || <span className="text-slate-300">Your name</span>}
              {phase === 'naming' && <span className="demo-caret" />}
            </p>
          </div>
          <div
            className="rounded-md py-1.5 text-center text-[9px] font-semibold text-white"
            style={{
              backgroundColor: '#16A34A',
              transition: `transform 0.2s ${EASE}`,
              transform: phase === 'submitting' && clicking ? 'scale(0.96)' : 'scale(1)',
            }}
          >
            Submit feedback
          </div>
        </div>

        {/* Moderation thank-you — the real embed's copy */}
        <div
          className="absolute bg-white rounded-xl shadow-2xl p-4 text-center"
          style={{
            left: 110,
            right: 110,
            top: '50%',
            transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
            opacity: phase === 'thanks' ? 1 : 0,
            transform: phase === 'thanks' ? 'translateY(-50%) scale(1)' : 'translateY(-46%) scale(0.95)',
          }}
        >
          <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <p className="text-[11px] font-semibold text-slate-900">Thank you</p>
          <p className="text-[9px] text-slate-500 leading-snug mt-0.5">
            Your feedback has been received and will appear on the map once it has been reviewed.
          </p>
        </div>

        {/* Published pin popup — the resting frame */}
        <div
          className="absolute bg-white rounded-lg shadow-xl p-2.5 w-[190px]"
          style={{
            left: PIN.x + 16,
            top: PIN.y - 26,
            transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
            opacity: phase === 'rest' ? 1 : 0,
            transform: phase === 'rest' ? 'translateY(0)' : 'translateY(5px)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#059669' }}>
              Positive
            </span>
            <span className="text-[8px] text-slate-400">{NAME}</span>
            <span className="ml-auto flex items-center gap-0.5 text-[8px] text-slate-400">
              <ThumbsUp size={8} /> 12
            </span>
          </div>
          <p className="text-[9px] text-slate-700 leading-snug">{COMMENT}</p>
        </div>

        {/* Cursor */}
        {!reduced && (
          <div
            className="absolute z-20"
            style={{
              left: 0,
              top: 0,
              transition: `transform 1.15s ${EASE}`,
              transform: `translate(${c.x}px, ${c.y}px) scale(${clicking ? 0.82 : 1})`,
              opacity: c.visible ? 1 : 0,
            }}
          >
            <svg width="17" height="20" viewBox="0 0 17 20">
              <path
                d="M1 1l5.2 15.6 2.5-6 6.2-2.2L1 1Z"
                fill="#1e293b"
                stroke="#fff"
                strokeWidth="1.4"
              />
            </svg>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pinDropIn {
          0% { opacity: 0; transform: translate(-50%, -100%) translateY(-26px) scale(0.7); }
          60% { opacity: 1; transform: translate(-50%, -100%) translateY(3px) scale(1.04); }
          100% { opacity: 1; transform: translate(-50%, -100%) translateY(0) scale(1); }
        }
        .pin-drop { animation: pinDropIn 0.5s ${EASE} both; }
        @keyframes pinRippleBox {
          from { width: 12px; height: 12px; opacity: 0.8; }
          to { width: 52px; height: 52px; opacity: 0; }
        }
        .pin-ripple { animation: pinRippleBox 0.7s ${EASE} both; }
        @keyframes caretBlink { 50% { opacity: 0; } }
        .demo-caret {
          display: inline-block; width: 1px; height: 9px;
          background: #16A34A; margin-left: 1px; vertical-align: -1px;
          animation: caretBlink 0.9s steps(1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pin-drop, .pin-ripple { animation-duration: 0.01s; }
        }
      `}</style>
    </div>
  )
}
