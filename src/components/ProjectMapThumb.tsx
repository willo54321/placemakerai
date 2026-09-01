'use client'

import { useState } from 'react'

/**
 * A map thumbnail for a project card. When the project has coordinates and a
 * Google Maps key is configured, it shows a real Static Maps image of the site;
 * if that fails to load (API not enabled, referrer blocked, no coords) it falls
 * back to a stylised, brand-coloured map motif seeded by the project id — so a
 * card never renders a broken tile. The motif also shows underneath while the
 * real image loads, avoiding a blank flash.
 */

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** mulberry32 — small deterministic PRNG so a seed always yields the same map. */
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 300
const H = 120

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Light styling: drop POI/transit clutter and desaturate a touch so a real map
// sits comfortably next to the brand-green UI.
const MAP_STYLE = [
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
  'feature:road|element:labels|visibility:simplified',
  'saturation:-30',
]

function staticMapUrl(lat: number, lng: number): string | null {
  if (!GOOGLE_KEY) return null
  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: '14',
    size: `${W}x${H}`,
    scale: '2',
    maptype: 'roadmap',
    markers: `color:0x16A34A|${lat},${lng}`,
    key: GOOGLE_KEY,
  })
  const style = MAP_STYLE.map((s) => `style=${encodeURIComponent(s)}`).join('&')
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}&${style}`
}

function Motif({ seed, latitude, longitude }: { seed: string; latitude?: number | null; longitude?: number | null }) {
  const rand = rng(hashSeed(`${seed}:${latitude ?? ''}:${longitude ?? ''}`))

  const roads: string[] = []
  const hCount = 2 + Math.floor(rand() * 2)
  const vCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < hCount; i++) {
    const y = (H * (i + 1)) / (hCount + 1) + (rand() - 0.5) * 18
    const drift = (rand() - 0.5) * 26
    roads.push(`M -10 ${y.toFixed(1)} C ${W * 0.35} ${(y + drift).toFixed(1)}, ${W * 0.65} ${(y - drift).toFixed(1)}, ${W + 10} ${y.toFixed(1)}`)
  }
  for (let i = 0; i < vCount; i++) {
    const x = (W * (i + 1)) / (vCount + 1) + (rand() - 0.5) * 22
    const drift = (rand() - 0.5) * 26
    roads.push(`M ${x.toFixed(1)} -10 C ${(x + drift).toFixed(1)} ${H * 0.35}, ${(x - drift).toFixed(1)} ${H * 0.65}, ${x.toFixed(1)} ${H + 10}`)
  }

  const bx = W * (0.42 + rand() * 0.16)
  const by = H * (0.42 + rand() * 0.16)
  const br = 22 + rand() * 10
  const boundary = Array.from({ length: 6 }, (_, i) => {
    const ang = (i / 6) * Math.PI * 2
    const r = br * (0.75 + rand() * 0.5)
    return `${(bx + Math.cos(ang) * r).toFixed(1)},${(by + Math.sin(ang) * r * 0.7).toFixed(1)}`
  }).join(' ')

  const pinCount = 3 + Math.floor(rand() * 3)
  const pins = Array.from({ length: pinCount }, () => ({
    x: bx + (rand() - 0.5) * br * 2.4,
    y: by + (rand() - 0.5) * br * 1.6,
  }))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Stylised project location map">
      <defs>
        <linearGradient id={`mapbg-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ECFDF5" />
          <stop offset="0.55" stopColor="#F0FDF4" />
          <stop offset="1" stopColor="#DCFCE7" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#mapbg-${seed})`} />
      <ellipse cx={W * 0.16} cy={H * 0.28} rx={34} ry={22} fill="#BBF7D0" opacity="0.6" />
      <g fill="none" strokeLinecap="round">
        {roads.map((d, i) => (
          <path key={`c${i}`} d={d} stroke="#D1D5DB" strokeWidth="7" opacity="0.7" />
        ))}
        {roads.map((d, i) => (
          <path key={`s${i}`} d={d} stroke="#FFFFFF" strokeWidth="4.5" />
        ))}
      </g>
      <polygon points={boundary} fill="rgba(22,163,74,0.14)" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
      {pins.map((p, i) => (
        <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
          <ellipse cx="0" cy="1.5" rx="4" ry="1.6" fill="rgba(0,0,0,0.12)" />
          <path d="M0 -12 C -5 -12 -8 -8 -8 -4 C -8 1 0 4 0 4 C 0 4 8 1 8 -4 C 8 -8 5 -12 0 -12 Z" fill="#16A34A" />
          <circle cx="0" cy="-5" r="2.4" fill="#FFFFFF" />
        </g>
      ))}
    </svg>
  )
}

export function ProjectMapThumb({
  seed,
  latitude,
  longitude,
  className,
}: {
  seed: string
  latitude?: number | null
  longitude?: number | null
  className?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const url =
    latitude != null && longitude != null && !imageFailed ? staticMapUrl(latitude, longitude) : null

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Motif is always the base layer — instant, and the fallback if the image fails. */}
      <div className="absolute inset-0">
        <Motif seed={seed} latitude={latitude} longitude={longitude} />
      </div>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Project location map"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  )
}
