'use client'

import { Mail, MapPin, FileText, Sparkles } from 'lucide-react'

/**
 * Service 04 visual: every feedback channel converging on the AI engine.
 * Three source nodes feed animated particles along curved paths into one
 * glowing engine node — pure SVG animateMotion, no video, no JS timeline.
 */

const EASE = 'cubic-bezier(0.19, 1, 0.22, 1)'

const SOURCES = [
  { icon: Mail, label: 'Public enquiries', y: 60 },
  { icon: MapPin, label: 'Map comments', y: 180 },
  { icon: FileText, label: 'Form responses', y: 300 },
]

// Curved paths from each source's right edge into the engine's left edge,
// on a 480x360 canvas.
const PATHS = [
  'M 150 60 C 250 60, 280 150, 352 172',
  'M 150 180 C 230 180, 260 180, 352 180',
  'M 150 300 C 250 300, 280 210, 352 188',
]

export default function FeedbackFlowDemo() {
  return (
    <div className="relative aspect-[4/3] w-full select-none" aria-label="Diagram: enquiries, map comments and form responses flowing into the AI analysis engine">
      <svg viewBox="0 0 480 360" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="flow-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(255,255,255,0.10)" />
            <stop offset="1" stopColor="rgba(22,163,74,0.55)" />
          </linearGradient>
          <radialGradient id="engine-glow">
            <stop offset="0" stopColor="rgba(22,163,74,0.35)" />
            <stop offset="1" stopColor="rgba(22,163,74,0)" />
          </radialGradient>
        </defs>

        {/* engine glow */}
        <circle cx="392" cy="180" r="120" fill="url(#engine-glow)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* connector paths */}
        {PATHS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="url(#flow-line)" strokeWidth="1.5" />
        ))}

        {/* travelling particles: three per path, staggered */}
        {PATHS.map((d, pathIndex) =>
          [0, 1, 2].map(n => (
            <circle key={`${pathIndex}-${n}`} r="3" fill="#4ADE80">
              <animateMotion
                dur={`${2.6 + pathIndex * 0.35}s`}
                begin={`${n * 0.9 + pathIndex * 0.3}s`}
                repeatCount="indefinite"
                path={d}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.85;1"
                dur={`${2.6 + pathIndex * 0.35}s`}
                begin={`${n * 0.9 + pathIndex * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))
        )}
      </svg>

      {/* Source nodes */}
      {SOURCES.map(source => (
        <div
          key={source.label}
          className="absolute flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-sm"
          style={{ left: '2%', top: `${(source.y / 360) * 100}%`, transform: 'translateY(-50%)', width: '29%' }}
        >
          <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <source.icon size={14} className="text-white/80" />
          </span>
          <span className="text-xs text-white/80 leading-tight">{source.label}</span>
        </div>
      ))}

      {/* Engine node */}
      <div
        className="absolute flex flex-col items-center gap-2"
        style={{ left: '82%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #15803D)',
            boxShadow: '0 0 40px rgba(22,163,74,0.45)',
            transition: `transform 0.4s ${EASE}`,
          }}
        >
          <Sparkles size={26} className="text-white" />
        </div>
        <span className="text-[11px] font-medium text-white/80 whitespace-nowrap">AI analysis engine</span>
        <span className="text-[9px] text-white/40 whitespace-nowrap">every response, one analysis</span>
      </div>
    </div>
  )
}
