'use client'

import { Sparkles } from 'lucide-react'

/**
 * Service 04 visual, in the style of Stripe's architecture diagrams:
 * dot-grid ground, a top band holding solid channel chips (plus dashed
 * ghost slots), dotted right-angle connectors dropping org-chart style
 * into the central engine tile, then straight down to actionable
 * insights. Particles ride the routes via SVG animateMotion.
 */

const CHANNELS = [
  { label: 'Public enquiries', x: 122 },
  { label: 'Map comments', x: 240 },
  { label: 'Form responses', x: 368 },
]

// Org-chart particle routes: down from each chip, along the rail, into the engine.
const ROUTES = [
  'M 122 72 L 122 104 L 240 104 L 240 148',
  'M 240 72 L 240 148',
  'M 368 72 L 368 104 L 240 104 L 240 148',
]

const OUTPUT_ROUTE = 'M 240 240 L 240 272'

const LINE = 'rgba(134, 239, 172, 0.30)'

export default function FeedbackFlowDemo() {
  return (
    <div className="relative aspect-[4/3] w-full select-none" aria-label="Diagram: enquiries, map comments and form responses flowing into the AI analysis engine, producing actionable insights">
      <svg viewBox="0 0 480 360" className="absolute inset-0 w-full h-full">
        <defs>
          <pattern id="dot-grid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)" />
          </pattern>
          <radialGradient id="engine-glow">
            <stop offset="0" stopColor="rgba(22,163,74,0.30)" />
            <stop offset="1" stopColor="rgba(22,163,74,0)" />
          </radialGradient>
        </defs>

        {/* dot-grid ground */}
        <rect width="480" height="360" fill="url(#dot-grid)" />

        {/* engine glow */}
        <circle cx="240" cy="192" r="105" fill="url(#engine-glow)">
          <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite" />
        </circle>

        {/* dotted right-angle connectors */}
        <g stroke={LINE} strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" fill="none">
          <path d="M 122 72 L 122 104" />
          <path d="M 240 72 L 240 148" />
          <path d="M 368 72 L 368 104" />
          <path d="M 122 104 L 368 104" />
          <path d="M 240 240 L 240 272" />
        </g>

        {/* travelling particles: channels → engine */}
        {ROUTES.map((d, routeIndex) =>
          [0, 1].map(n => (
            <circle key={`${routeIndex}-${n}`} r="2.5" fill="#4ADE80">
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
          <circle key={`out-${n}`} r="2.5" fill="#4ADE80">
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

      {/* Top band holding the channel chips */}
      <div
        className="absolute rounded-xl border border-white/[0.07] bg-white/[0.04] flex items-center justify-between px-2.5"
        style={{ left: '6.5%', right: '6.5%', top: `${(19 / 360) * 100}%`, height: `${(53 / 360) * 100}%` }}
      >
        <span className="hidden sm:block w-8 h-7 rounded-lg border border-dashed border-white/15 shrink-0" />
        {CHANNELS.map(channel => (
          <span
            key={channel.label}
            className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-medium text-white whitespace-nowrap"
            style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
          >
            {channel.label}
          </span>
        ))}
        <span className="hidden sm:block w-8 h-7 rounded-lg border border-dashed border-white/15 shrink-0" />
      </div>

      {/* Engine tile */}
      <div
        className="absolute flex flex-col items-center gap-1"
        style={{ left: '50%', top: `${(194 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="w-[52px] h-[52px] rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #16A34A, #14532D)',
            boxShadow: '0 0 36px rgba(22,163,74,0.45)',
          }}
        >
          <Sparkles size={22} className="text-white" />
        </div>
        <span className="text-[10.5px] font-medium text-white/80 whitespace-nowrap">AI analysis engine</span>
        <span className="text-[8.5px] text-white/40 whitespace-nowrap -mt-0.5">every response, one analysis</span>
      </div>

      {/* Bottom row: insights chip flanked by ghost slots */}
      <div
        className="absolute flex items-center justify-center gap-3"
        style={{ left: '50%', top: `${(292 / 360) * 100}%`, transform: 'translate(-50%, -50%)' }}
      >
        <span className="w-9 h-8 rounded-lg border border-dashed border-white/15 shrink-0" />
        <span
          className="rounded-lg px-3 py-2 text-[10.5px] font-medium text-white whitespace-nowrap"
          style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
        >
          Actionable insights
        </span>
        <span className="w-9 h-8 rounded-lg border border-dashed border-white/15 shrink-0" />
      </div>
    </div>
  )
}
