'use client'

import { useEffect, useRef, useState } from 'react'
import { ThumbsUp, X, Eye, Upload, Image as ImageIcon, Layers, ChevronLeft, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'

/**
 * Three miniature looping product demos for the modal's "More to discover"
 * cards — each a faithful re-enactment of the real UI:
 *
 *  1. MiniShapesDemo — pin, route and area on the map, with the real popup's
 *     grey metric chips (InteractiveMap.tsx: "Area: x ha" / "Length: x km")
 *  2. MiniVotingDemo — the public embed's pin popup (EmbedMap.tsx): solid
 *     category pill, attribution line, and the Vote button flipping to the
 *     green Voted state
 *  3. MiniLayersDemo — the admin Map Layers sidebar (projects/[id]/map.tsx):
 *     Images/Geo Data tabs, the dashed "Add Overlay (up to 50MB)" dropzone,
 *     Uploading state, and the overlay card with eye toggle + sliders
 *
 * Same easing as the big demos; loop while mounted (they only mount inside
 * the open modal). Reduced motion renders the finished frame.
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

  const chip = (on: boolean) => ({
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

      {/* Category pill — as on the embed popup (solid, white bold label) */}
      <span
        className="absolute left-[27%] top-[12%] inline-flex items-center bg-[#10B981] text-white rounded-full shadow-md px-2 py-0.5 text-[9px] font-bold tracking-wide"
        style={chip(phase >= 1)}
      >
        POSITIVE
      </span>

      {/* Metric chips — the real popup's grey badges */}
      <span
        className="absolute left-[8%] bottom-[6%] inline-flex items-center bg-white rounded shadow-md px-2 py-1 text-[9.5px] font-medium text-slate-500"
        style={chip(phase >= 2)}
      >
        Length: 0.34 km
      </span>
      <span
        className="absolute right-[4%] top-[46%] inline-flex items-center bg-white rounded shadow-md px-2 py-1 text-[9.5px] font-medium text-slate-500"
        style={chip(phase >= 3)}
      >
        Area: 0.42 ha
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — Community Voting & Moderation                                  */
/* ------------------------------------------------------------------ */

export function MiniVotingDemo() {
  // 1-2 votes arriving from others · 3 our vote lands → green Voted state
  const phase = useLoop(
    [
      { at: 1100, phase: 1 },
      { at: 2300, phase: 2 },
      { at: 3900, phase: 3 },
    ],
    8600,
    3
  )
  const voted = phase >= 3
  const votes = 12 + phase

  return (
    <div className="relative w-full h-full flex items-center justify-center px-5 select-none" aria-label="Demo: the map pin popup where residents upvote feedback they agree with">
      {/* The public embed's pin popup, faithfully */}
      <div className="w-full max-w-[250px] bg-white rounded-xl shadow-2xl p-3.5 relative">
        <span className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center bg-gray-100 rounded-full">
          <X size={11} className="text-gray-500" />
        </span>

        <div className="flex items-start justify-between gap-2 mb-1.5 pr-6">
          <h3 className="text-[11px] font-semibold text-gray-900 leading-tight flex-1">
            Keep the oaks on the footpath
          </h3>
          <span className="text-[8px] font-bold text-white px-2 py-0.5 rounded-full whitespace-nowrap bg-[#10B981]">
            POSITIVE
          </span>
        </div>

        <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
          Please keep the mature oaks along this footpath — they screen the whole close.
        </p>

        <p className="text-[9px] text-gray-400 mb-2.5">— Margaret H. · 30 Aug 2026</p>

        {/* Vote button ⇄ Voted state, exactly as EmbedMap.tsx */}
        <div className="relative h-[30px]">
          <span
            className="absolute inset-0 flex items-center justify-center border border-gray-200 rounded-lg"
            style={{ opacity: voted ? 0 : 1, transition: `opacity 0.35s ${EASE}` }}
          >
            <ThumbsUp size={12} className="mr-1.5 text-[#10B981]" />
            <span
              className="text-gray-700 font-medium text-[10px] mr-1"
              style={{
                fontVariantNumeric: 'tabular-nums',
                transform: phase >= 1 && phase <= 2 ? 'scale(1.15)' : 'scale(1)',
                transition: `transform 0.3s ${EASE}`,
                display: 'inline-block',
              }}
            >
              {Math.min(votes, 14)}
            </span>
            <span className="text-gray-500 text-[10px]">Votes</span>
          </span>
          <span
            className="absolute inset-0 flex items-center justify-center border border-green-200 bg-green-50 rounded-lg"
            style={{
              opacity: voted ? 1 : 0,
              transform: voted ? 'scale(1)' : 'scale(0.96)',
              transition: `opacity 0.35s ${EASE}, transform 0.35s ${EASE}`,
            }}
          >
            <ThumbsUp size={12} className="text-green-500 mr-1.5" fill="currentColor" />
            <span className="text-green-700 font-medium text-[10px] mr-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
              15
            </span>
            <span className="text-green-600 text-[10px]">Voted</span>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 03 — Layers & Overlays                                              */
/* ------------------------------------------------------------------ */

export function MiniLayersDemo() {
  // 1 dropzone highlights · 2 uploading · 3 overlay card lands · 4 controls open
  const phase = useLoop(
    [
      { at: 900, phase: 1 },
      { at: 1800, phase: 2 },
      { at: 3400, phase: 3 },
      { at: 4600, phase: 4 },
    ],
    9400,
    4
  )
  const uploading = phase === 2
  const landed = phase >= 3

  return (
    <div className="relative w-full h-full flex items-center justify-center px-5 select-none" aria-label="Demo: the Map Layers panel — uploading an overlay, then adjusting opacity and rotation">
      {/* The admin Map Layers sidebar, faithfully */}
      <div className="w-full max-w-[220px] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
        {/* Brand header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#16A34A] text-white">
          <span className="font-semibold text-[10px]">Map Layers</span>
          <ChevronLeft size={11} className="opacity-80" />
        </div>

        {/* Images / Geo Data tabs */}
        <div className="flex border-b border-gray-200 text-[9px] font-medium">
          <span className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[#16A34A] border-b-2 border-[#16A34A] bg-green-50">
            <ImageIcon size={9} /> Images
            <span
              className="text-[8px] bg-gray-200 px-1 py-px rounded"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {landed ? 1 : 0}
            </span>
          </span>
          <span className="flex-1 flex items-center justify-center gap-1 py-1.5 text-gray-500">
            <Layers size={9} /> Geo Data
            <span className="text-[8px] bg-gray-200 px-1 py-px rounded">2</span>
          </span>
        </div>

        {/* Add Overlay dropzone — real copy and states */}
        <div className="p-2 border-b border-gray-100">
          <div
            className="flex items-center justify-center gap-1.5 py-2 px-2 border-2 border-dashed rounded-lg"
            style={{
              borderColor: phase === 1 || uploading ? '#4ADE80' : '#D1D5DB',
              backgroundColor: phase === 1 || uploading ? '#F0FDF4' : 'transparent',
              transition: `border-color 0.4s ${EASE}, background-color 0.4s ${EASE}`,
            }}
          >
            {uploading ? (
              <>
                <span className="animate-spin w-2.5 h-2.5 border-2 border-[#16A34A] border-t-transparent rounded-full" />
                <span className="text-[9px] text-gray-600">Uploading...</span>
              </>
            ) : (
              <>
                <Upload size={11} className="text-gray-400" />
                <span className="text-[9px] text-gray-600">Add Overlay (up to 50MB)</span>
              </>
            )}
          </div>
        </div>

        {/* Uploaded overlay card */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: landed ? 120 : 0,
            opacity: landed ? 1 : 0,
            transition: `max-height 0.6s ${EASE}, opacity 0.5s ${EASE}`,
          }}
        >
          <div className="m-2 rounded-lg border border-[#4ADE80] bg-green-50/60 shadow-sm">
            <div className="flex items-center gap-1.5 p-1.5">
              <span className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                <ImageIcon size={12} className="text-gray-400" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-[9px] text-gray-800 truncate">site-masterplan.png</span>
                <span className="block text-[8px] text-gray-400">80% opacity</span>
              </span>
              <span className="p-1 rounded text-[#16A34A] bg-green-100">
                <Eye size={10} />
              </span>
            </div>

            {/* Opacity + Rotation sliders — real expanded controls */}
            <div
              className="px-2 pb-2 space-y-1.5 overflow-hidden"
              style={{
                maxHeight: phase >= 4 ? 60 : 0,
                opacity: phase >= 4 ? 1 : 0,
                transition: `max-height 0.5s ${EASE}, opacity 0.5s ${EASE}`,
              }}
            >
              {[
                { label: 'Opacity', value: '80%', fill: phase >= 4 ? '80%' : '0%' },
                { label: 'Rotation', value: '14°', fill: phase >= 4 ? '12%' : '0%' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-[8px] mb-0.5">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="text-gray-700 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.value}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#16A34A] rounded-full"
                      style={{ width: row.fill, transition: `width 0.9s ${EASE}` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — API Integration                                                */
/* ------------------------------------------------------------------ */

const API_LINES = [
  { text: 'POST /api/projects/{id}/feedback', color: '#7DD3FC' },
  { text: '{', color: '#94A3B8' },
  { text: '  "name": "Tom Wilson",', color: '#E2E8F0' },
  { text: '  "email": "tom@example.com",', color: '#E2E8F0' },
  { text: '  "rating": 4,', color: '#E2E8F0' },
  { text: '  "gdprConsent": true', color: '#E2E8F0' },
  { text: '}', color: '#94A3B8' },
]

export function MiniApiDemo() {
  // phase = lines revealed; 8 = schema detected
  const phase = useLoop(
    [
      { at: 500, phase: 1 },
      { at: 1000, phase: 2 },
      { at: 1400, phase: 3 },
      { at: 1800, phase: 4 },
      { at: 2200, phase: 5 },
      { at: 2600, phase: 6 },
      { at: 3000, phase: 7 },
      { at: 3900, phase: 8 },
    ],
    8800,
    8
  )

  return (
    <div className="relative w-full h-full flex items-center justify-center px-4 select-none" aria-label="Demo: an external website posting a form submission to the API, fields detected automatically">
      <div className="w-full max-w-[240px]">
        {/* Code panel */}
        <div className="bg-[#0F172A] rounded-lg p-3 shadow-xl font-mono text-[8.5px] leading-[1.7]">
          {API_LINES.map((line, index) => (
            <p
              key={index}
              style={{
                color: line.color,
                opacity: phase >= index + 1 ? 1 : 0,
                transition: `opacity 0.3s ${EASE}`,
                whiteSpace: 'pre',
              }}
            >
              {line.text}
            </p>
          ))}
        </div>

        {/* Auto-detected schema */}
        <div
          className="mt-2 bg-white rounded-lg border border-slate-200 shadow-md px-2.5 py-2"
          style={{
            opacity: phase >= 8 ? 1 : 0,
            transform: phase >= 8 ? 'translateY(0)' : 'translateY(5px)',
            transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
          }}
        >
          <p className="text-[8.5px] font-semibold text-slate-700 flex items-center gap-1 mb-1">
            <CheckCircle size={9} className="text-[#16A34A]" /> 4 fields detected — schema built
          </p>
          <div className="flex flex-wrap gap-1">
            {['name', 'email', 'rating', 'gdprConsent'].map(field => (
              <span key={field} className="text-[8px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — Built-In Compliance                                            */
/* ------------------------------------------------------------------ */

export function MiniComplianceDemo() {
  // 1 consent ticked · 2 submit enabled+pressed · 3 recorded
  const phase = useLoop(
    [
      { at: 1100, phase: 1 },
      { at: 2300, phase: 2 },
      { at: 3400, phase: 3 },
    ],
    8400,
    3
  )
  const ticked = phase >= 1

  return (
    <div className="relative w-full h-full flex items-center justify-center px-5 select-none" aria-label="Demo: GDPR consent required before submitting, with the consent timestamp recorded">
      {/* The public form's GDPR footer, faithfully */}
      <div className="w-full max-w-[230px] bg-white rounded-xl shadow-xl p-3">
        <div className="flex items-start gap-2 pt-1">
          <span
            className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 mt-0.5"
            style={{
              borderColor: ticked ? '#2563EB' : '#D1D5DB',
              backgroundColor: ticked ? '#2563EB' : '#FFFFFF',
              transition: `background-color 0.3s ${EASE}, border-color 0.3s ${EASE}`,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 10 10" style={{ opacity: ticked ? 1 : 0, transition: `opacity 0.2s ${EASE}` }}>
              <path d="M1.5 5.5 L4 8 L8.5 2.5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-[8.5px] text-gray-600 leading-relaxed">
            I consent to my data being processed to respond to my feedback. <span className="text-red-500">*</span>{' '}
            <span className="text-blue-600 underline">Privacy Policy</span>
          </p>
        </div>

        <span
          className="mt-2.5 w-full flex items-center justify-center bg-blue-600 text-white text-[9px] font-medium py-1.5 rounded-lg"
          style={{
            opacity: ticked ? 1 : 0.5,
            transform: phase === 2 ? 'scale(0.97)' : 'scale(1)',
            transition: `opacity 0.4s ${EASE}, transform 0.25s ${EASE}`,
          }}
        >
          Submit feedback
        </span>

        {/* Recorded automatically */}
        <div
          className="mt-2.5 space-y-1 border-t border-gray-100 pt-2"
          style={{
            opacity: phase >= 3 ? 1 : 0,
            transform: phase >= 3 ? 'translateY(0)' : 'translateY(4px)',
            transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
          }}
        >
          <p className="text-[8px] text-gray-500 flex items-center gap-1">
            <CheckCircle size={8} className="text-[#16A34A] shrink-0" /> Consent recorded — Sat 30 Aug 2026, 14:32
          </p>
          <p className="text-[8px] text-gray-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm border border-gray-300 shrink-0" /> Mailing list opt-in — kept separate
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 02 — Smart Responses                                                */
/* ------------------------------------------------------------------ */

export function MiniResponsesDemo() {
  // 1 card expands · 2 email highlighted
  const phase = useLoop(
    [
      { at: 1400, phase: 1 },
      { at: 3400, phase: 2 },
      { at: 6200, phase: 0 },
    ],
    8600,
    2
  )
  const expanded = phase >= 1

  return (
    <div className="relative w-full h-full flex items-center justify-center px-5 select-none" aria-label="Demo: a form response card expanding, with name and email detected automatically">
      {/* The Responses tab card, faithfully */}
      <div
        className="w-full max-w-[240px] bg-white rounded-xl border"
        style={{
          borderColor: expanded ? '#BFDBFE' : '#E2E8F0',
          boxShadow: expanded
            ? '0 4px 6px -1px rgba(0,0,0,0.1), 0 0 0 1px rgba(219,234,254,1)'
            : '0 1px 2px rgba(0,0,0,0.05)',
          transition: `border-color 0.4s ${EASE}, box-shadow 0.4s ${EASE}`,
        }}
      >
        <div className="w-full p-2.5 flex items-start gap-2">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-semibold text-[10px]"
            style={{
              backgroundColor: expanded ? '#DBEAFE' : '#F1F5F9',
              color: expanded ? '#1D4ED8' : '#475569',
              transition: `background-color 0.4s ${EASE}, color 0.4s ${EASE}`,
            }}
          >
            T
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[10px] text-slate-900">Tom Wilson</span>
              <span
                className="text-[8.5px] text-blue-600"
                style={{
                  textDecoration: phase >= 2 ? 'underline' : 'none',
                  transition: `all 0.3s ${EASE}`,
                }}
              >
                tom@example.com
              </span>
            </span>
            <span className="block text-[8px] text-slate-400 mt-0.5">Sat, 30 Aug 2026, 10:02</span>
            {!expanded && (
              <span className="block text-[8.5px] text-slate-500 mt-1 truncate">
                <span className="text-slate-400">Your View:</span> The four-storey block would…
              </span>
            )}
          </span>
          <span
            className="p-1 rounded-lg shrink-0"
            style={{
              backgroundColor: expanded ? '#DBEAFE' : '#F1F5F9',
              transition: `background-color 0.4s ${EASE}`,
            }}
          >
            {expanded ? (
              <ChevronUp size={11} className="text-blue-600" />
            ) : (
              <ChevronDown size={11} className="text-slate-400" />
            )}
          </span>
        </div>

        {/* Expanded fields */}
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? 110 : 0,
            opacity: expanded ? 1 : 0,
            transition: `max-height 0.55s ${EASE}, opacity 0.45s ${EASE}`,
          }}
        >
          <div className="px-2.5 pb-2.5 space-y-1.5">
            <div className="bg-slate-50 rounded-lg px-2 py-1.5">
              <p className="text-[7.5px] font-medium text-slate-400 uppercase tracking-wide">Your view</p>
              <p className="text-[8.5px] text-slate-700 leading-snug">
                The four-storey block would overshadow every garden on Elm Grove.
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg px-2 py-1.5">
              <p className="text-[7.5px] font-medium text-slate-400 uppercase tracking-wide">Attend the exhibition?</p>
              <p className="text-[8.5px] text-slate-700">Yes — Saturday session</p>
            </div>
            <p className="text-[7.5px] text-slate-400 flex items-center gap-1">
              <CheckCircle size={7} className="text-[#16A34A]" /> GDPR consent recorded
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
