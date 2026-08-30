'use client'

import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, CheckCircle, MapPin, Route, Pentagon, Eye } from 'lucide-react'

/**
 * Three miniature looping product demos for the modal's "More to discover"
 * cards — Stripe-style: a small self-running visual per feature.
 *
 *  1. MiniShapesDemo  — pin drops, route draws, area outlines, each measured
 *  2. MiniVotingDemo  — upvotes arrive and the most-supported comment surfaces
 *  3. MiniLayersDemo  — boundary, planning zone and render toggle on in turn
 *
 * All ride the same easing as the big demos and loop while mounted (they only
 * mount inside the open modal). Reduced motion renders the finished frame.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

/** Advance `phase` through a timeline of {at, phase} marks, looping. */
function useLoop(marks: { at: number; phase: number }[], loopMs: number, maxPhase: number) {
  const [phase, setPhase] = useState(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase(maxPhase)
      return
    }
    let cancelled = false
    const run = () => {
      if (cancelled) return
      timers.current.forEach(clearTimeout)
      timers.current = []
      setPhase(0)
      marks.forEach(mark => {
        timers.current.push(setTimeout(() => setPhase(mark.phase), mark.at))
      })
      timers.current.push(setTimeout(run, loopMs))
    }
    run()
    return () => {
      cancelled = true
      timers.current.forEach(clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return phase
}

/* ------------------------------------------------------------------ */
/* 01 — Pins, Lines & Polygons                                         */
/* ------------------------------------------------------------------ */

const ROUTE_LENGTH = 260

export function MiniShapesDemo() {
  // 1 pin · 2 route · 3 area
  const phase = useLoop(
    [
      { at: 700, phase: 1 },
      { at: 2600, phase: 2 },
      { at: 4900, phase: 3 },
    ],
    8600,
    3
  )

  const chip = (label: string, on: boolean) => ({
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : 'translateY(4px)',
    transition: `opacity 0.45s ${EASE}, transform 0.45s ${EASE}`,
  })

  return (
    <div className="relative w-full h-full select-none" aria-label="Demo: pins, routes and areas drawn on the map with automatic measurements">
      <svg viewBox="0 0 200 150" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <rect width="200" height="150" fill="#F1F3F4" />
        <path d="M14 26 L88 16 L104 52 L74 86 L20 80 Z" fill="#CEEAD6" />
        <path d="M150 108 Q170 100 200 106 L200 150 L136 150 Q140 126 150 108 Z" fill="#AADAFF" opacity="0.6" />
        <g fill="#E8EAED">
          <rect x="118" y="24" width="22" height="14" rx="1" />
          <rect x="148" y="20" width="18" height="20" rx="1" />
          <rect x="122" y="62" width="20" height="13" rx="1" />
          <rect x="26" y="106" width="22" height="14" rx="1" />
          <rect x="58" y="112" width="17" height="12" rx="1" />
        </g>
        <g strokeLinecap="round" fill="none">
          <path d="M0 96 L200 88" stroke="#DADCE0" strokeWidth="7" />
          <path d="M0 96 L200 88" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M108 0 L112 52 L109 150" stroke="#DADCE0" strokeWidth="6" />
          <path d="M108 0 L112 52 L109 150" stroke="#FFFFFF" strokeWidth="4" />
        </g>

        {/* Route — draws itself */}
        <path
          d="M18 132 C 52 118, 88 128, 118 108 S 176 78, 190 62"
          fill="none"
          stroke="#6366F1"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={ROUTE_LENGTH}
          strokeDashoffset={phase >= 2 ? 0 : ROUTE_LENGTH}
          style={{ transition: `stroke-dashoffset 1.4s ${EASE}` }}
        />

        {/* Area — outlines then fills */}
        <polygon
          points="124,18 168,26 160,66 118,58"
          fill="rgba(245, 158, 11, 0.22)"
          stroke="#F59E0B"
          strokeWidth="1.8"
          strokeLinejoin="round"
          style={{ opacity: phase >= 3 ? 1 : 0, transition: `opacity 0.7s ${EASE}` }}
        />
      </svg>

      {/* Pin — drops in */}
      <div
        className="absolute"
        style={{
          left: '24%',
          top: '34%',
          opacity: phase >= 1 ? 1 : 0,
          transform: phase >= 1 ? 'translate(-50%, -100%)' : 'translate(-50%, -140%)',
          transition: `opacity 0.4s ${EASE}, transform 0.5s ${EASE}`,
        }}
      >
        <svg width="22" height="28" viewBox="0 0 22 28">
          <path d="M11 0C5 0 0 5 0 11c0 8 11 17 11 17s11-9 11-17C22 5 17 0 11 0Z" fill="#10B981" />
          <circle cx="11" cy="11" r="4.5" fill="#fff" />
        </svg>
      </div>

      {/* Measurement chips */}
      <span
        className="absolute left-[27%] top-[12%] inline-flex items-center gap-1 bg-white rounded-full shadow-md px-2 py-1 text-[10px] font-semibold text-emerald-700"
        style={chip('Positive', phase >= 1)}
      >
        <MapPin size={10} /> Positive
      </span>
      <span
        className="absolute left-[8%] bottom-[6%] inline-flex items-center gap-1 bg-white rounded-full shadow-md px-2 py-1 text-[10px] font-semibold text-indigo-700"
        style={chip('Route', phase >= 2)}
      >
        <Route size={10} /> Route — 340 m
      </span>
      <span
        className="absolute right-[4%] top-[44%] inline-flex items-center gap-1 bg-white rounded-full shadow-md px-2 py-1 text-[10px] font-semibold text-amber-700"
        style={chip('Area', phase >= 3)}
      >
        <Pentagon size={10} /> Area — 0.42 ha
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — Community Voting & Moderation                                  */
/* ------------------------------------------------------------------ */

export function MiniVotingDemo() {
  // phase = number of extra upvotes landed (0-3); 4 = "most supported" chip
  const phase = useLoop(
    [
      { at: 1000, phase: 1 },
      { at: 2100, phase: 2 },
      { at: 3400, phase: 3 },
      { at: 4400, phase: 4 },
    ],
    8800,
    4
  )
  const votes = 12 + Math.min(phase, 3)

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-2.5 px-4 select-none" aria-label="Demo: residents upvote feedback and the most-supported comment surfaces">
      {/* Leading comment */}
      <div
        className="w-full max-w-[240px] bg-white rounded-xl shadow-md border border-slate-100 p-3 relative"
        style={{
          transform: phase >= 4 ? 'scale(1.03)' : 'scale(1)',
          transition: `transform 0.6s ${EASE}`,
        }}
      >
        <span
          className="absolute -top-2 right-3 inline-flex items-center gap-1 bg-[#16A34A] text-white rounded-full px-2 py-0.5 text-[9px] font-semibold shadow-sm"
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(4px)',
            transition: `opacity 0.45s ${EASE}, transform 0.45s ${EASE}`,
          }}
        >
          Most supported
        </span>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#D1FAE5] text-[#059669]">Positive</span>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle size={8} /> Approved
          </span>
          <span className="text-[9px] text-slate-400">Margaret H.</span>
        </div>
        <p className="text-[10px] text-slate-700 leading-snug mb-2">
          Please keep the mature oaks along this footpath — they screen the whole close.
        </p>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{
            backgroundColor: '#DCFCE7',
            color: '#15803D',
            fontVariantNumeric: 'tabular-nums',
            transform: phase >= 1 && phase <= 3 ? 'scale(1.06)' : 'scale(1)',
            transition: `transform 0.35s ${EASE}`,
          }}
        >
          <ThumbsUp size={10} /> {votes}
        </span>
      </div>

      {/* Runner-up comment */}
      <div className="w-full max-w-[240px] bg-white rounded-xl shadow-sm border border-slate-100 p-3 opacity-80">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#E0E7FF] text-[#4F46E5]">Comment</span>
          <span className="text-[9px] text-slate-400">Priya K.</span>
        </div>
        <p className="text-[10px] text-slate-600 leading-snug mb-2">
          Parking on Weald Road is already impossible on match days.
        </p>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          <ThumbsUp size={10} /> 8
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 03 — Layers & Overlays                                              */
/* ------------------------------------------------------------------ */

const LAYERS = [
  { name: 'Site boundary', color: '#EF4444' },
  { name: 'Planning zone', color: '#3B82F6' },
  { name: 'Masterplan render', color: '#16A34A' },
]

export function MiniLayersDemo() {
  // phase n = layers 1..n switched on
  const phase = useLoop(
    [
      { at: 900, phase: 1 },
      { at: 2500, phase: 2 },
      { at: 4100, phase: 3 },
    ],
    8200,
    3
  )

  const overlay = (on: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity 0.7s ${EASE}, transform 0.9s ${EASE}`,
    ...extra,
  })

  return (
    <div className="relative w-full h-full select-none" aria-label="Demo: site boundary, planning zone and masterplan render layers toggling on the map">
      <svg viewBox="0 0 200 150" className="absolute inset-0 w-full h-full" aria-hidden="true">
        <rect width="200" height="150" fill="#F1F3F4" />
        <path d="M120 10 L190 20 L184 70 L128 60 Z" fill="#CEEAD6" opacity="0.7" />
        <g strokeLinecap="round" fill="none">
          <path d="M0 110 L200 100" stroke="#DADCE0" strokeWidth="7" />
          <path d="M0 110 L200 100" stroke="#FFFFFF" strokeWidth="5" />
          <path d="M64 0 L70 60 L66 150" stroke="#DADCE0" strokeWidth="6" />
          <path d="M64 0 L70 60 L66 150" stroke="#FFFFFF" strokeWidth="4" />
        </g>

        {/* Site boundary — dashed red outline */}
        <polygon
          points="82,22 172,32 164,88 90,80"
          fill="none"
          stroke="#EF4444"
          strokeWidth="2"
          strokeDasharray="5 3"
          strokeLinejoin="round"
          style={overlay(phase >= 1)}
        />

        {/* Planning zone — translucent blue */}
        <polygon
          points="96,34 150,40 146,72 100,68"
          fill="rgba(59, 130, 246, 0.20)"
          stroke="#3B82F6"
          strokeWidth="1.5"
          strokeLinejoin="round"
          style={overlay(phase >= 2)}
        />
      </svg>

      {/* Masterplan render — image overlay easing into place */}
      <div
        className="absolute rounded-sm overflow-hidden shadow-lg"
        style={overlay(phase >= 3, {
          left: '52%',
          top: '26%',
          width: '30%',
          aspectRatio: '4 / 3',
          transform: phase >= 3 ? 'rotate(-2deg) scale(1)' : 'rotate(-8deg) scale(0.9)',
          background: 'linear-gradient(135deg, #ECFDF5 0%, #BBF7D0 45%, #86EFAC 100%)',
          border: '2px solid #FFFFFF',
        })}
      >
        <svg viewBox="0 0 60 45" className="w-full h-full" aria-hidden="true">
          <rect x="8" y="22" width="12" height="14" rx="1" fill="#16A34A" opacity="0.55" />
          <rect x="24" y="16" width="14" height="20" rx="1" fill="#15803D" opacity="0.5" />
          <rect x="42" y="24" width="10" height="12" rx="1" fill="#16A34A" opacity="0.45" />
          <path d="M4 40 Q30 34 56 39" stroke="#FFFFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      {/* Layers panel */}
      <div className="absolute left-2 top-2 bg-white rounded-lg shadow-md border border-slate-100 p-2 w-[118px]">
        <p className="text-[8.5px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-0.5">Layers</p>
        <div className="space-y-1">
          {LAYERS.map((layer, index) => {
            const on = phase >= index + 1
            return (
              <div key={layer.name} className="flex items-center gap-1.5 px-0.5">
                <span
                  className="w-6 h-3.5 rounded-full relative shrink-0"
                  style={{
                    backgroundColor: on ? '#16A34A' : '#E2E8F0',
                    transition: `background-color 0.4s ${EASE}`,
                  }}
                >
                  <span
                    className="absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow-sm"
                    style={{ left: on ? 12 : 2, transition: `left 0.4s ${EASE}` }}
                  />
                </span>
                <span className="text-[9px] font-medium text-slate-700 leading-none truncate">{layer.name}</span>
                <Eye
                  size={9}
                  className="ml-auto shrink-0"
                  style={{ color: on ? layer.color : '#CBD5E1', transition: `color 0.4s ${EASE}` }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
