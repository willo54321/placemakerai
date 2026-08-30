'use client'

import { Mail, MapPin, FileText, Sparkles, Lightbulb } from 'lucide-react'

/**
 * Service 04 visual: every feedback channel converging on the AI engine.
 * Org-chart layout — three sources in a horizontal row, dotted connectors
 * dropping to a rail and down into the engine, then a straight line down
 * to actionable insights. Particles ride the routes via SVG animateMotion.
 */

const SOURCES = [
  { icon: Mail, label: 'Public enquiries', x: 85 },
  { icon: MapPin, label: 'Map comments', x: 240 },
  { icon: FileText, label: 'Form responses', x: 395 },
]

// Org-chart particle routes on the 480x360 canvas: down from each card,
// along the rail, then down into the engine.
const ROUTES = [
  'M 85 72 L 85 106 L 240 106 L 240 140',
  'M 240 72 L 240 140',
  'M 395 72 L 395 106 L 240 106 L 240 140',
]

const OUTPUT_ROUTE = 'M 240 232 L 240 278'

export default function FeedbackFlowDemo() {
  return (
    <div className="relative aspect-[4/3] w-full select-none" aria-label="Diagram: enquiries, map comments and form responses flowing into the AI analysis engine, producing actionable insights">
      <svg viewBox="0 0 480 360" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id="engine-glow">
            <stop offset="0" stopColor="rgba(22,163,74,0.35)" />
            <stop offset="1" stopColor="rgba(22,163,74,0)" />
          </radialGradient>
        </defs>

        {/* engine glow */}
        <circle cx="240" cy="168" r="110" fill="url(#engine-glow)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* org-chart dotted connectors */}
        <g stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" fill="none">
          <path d="M 85 72 L 85 106" />
          <path d="M 240 72 L 240 140" />
          <path d="M 395 72 L 395 106" />
          <path d="M 85 106 L 395 106" />
          <path d="M 240 232 L 240 278" />
        </g>

        {/* travelling particles: sources → engine */}
        {ROUTES.map((d, routeIndex) =>
          [0, 1].map(n => (
            <circle key={`${routeIndex}-${n}`} r="3" fill="#4ADE80">
              <animateMotion
                dur={`${2.4 + routeIndex * 0.3}s`}
                begin={`${n * 1.3 + routeIndex * 0.45}s`}
                repeatCount="indefinite"
                path={d}
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.1;0.85;1"
                dur={`${2.4 + routeIndex * 0.3}s`}
                begin={`${n * 1.3 + routeIndex * 0.45}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))
        )}

        {/* travelling particles: engine → insights */}
        {[0, 1].map(n => (
          <circle key={`out-${n}`} r="3" fill="#4ADE80">
            <animateMotion dur="1.8s" begin={`${n * 0.9}s`} repeatCount="indefinite" path={OUTPUT_ROUTE} />
            <animate
              attributeName="opacity"
              values="0;1;1;0"
              keyTimes="0;0.15;0.8;1"
              dur="1.8s"
              begin={`${n * 0.9}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>

      {/* Source nodes — horizontal row */}
      {SOURCES.map(source => (
        <div
          key={source.label}
          className="absolute flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2.5 py-2 backdrop-blur-sm"
          style={{
            left: `${(source.x / 480) * 100}%`,
            top: `${(46 / 360) * 100}%`,
            transform: 'translate(-50%, -50%)',
            width: '27%',
          }}
        >
          <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <source.icon size={13} className="text-white/80" />
          </span>
          <span className="text-[11px] text-white/80 leading-tight">{source.label}</span>
        </div>
      ))}

      {/* Engine node */}
      <div
        className="absolute flex flex-col items-center gap-1.5"
        style={{ left: '50%', top: `${(168 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #15803D)',
            boxShadow: '0 0 40px rgba(22,163,74,0.45)',
          }}
        >
          <Sparkles size={24} className="text-white" />
        </div>
        <span className="text-[11px] font-medium text-white/80 whitespace-nowrap">AI analysis engine</span>
        <span className="text-[9px] text-white/40 whitespace-nowrap -mt-1">every response, one analysis</span>
      </div>

      {/* Actionable insights node */}
      <div
        className="absolute flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 backdrop-blur-sm"
        style={{ left: '50%', top: `${(305 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <span className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
          <Lightbulb size={13} className="text-[#4ADE80]" />
        </span>
        <span className="text-[11px] text-white/80 leading-tight whitespace-nowrap">Actionable insights</span>
      </div>
    </div>
  )
}
