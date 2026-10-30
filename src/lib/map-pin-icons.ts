// The product's map-pin visual language, shared by the public embed and the
// admin maps (issues + response moderation) so every surface draws identical
// pins. Functions touch google.maps and must only be called after the Maps
// JS API has loaded.

// Pin body colour per category (feedback + construction-issue ids don't collide)
export const PIN_COLORS: Record<string, string> = {
  question: '#F59E0B',
  negative: '#EF4444',
  positive: '#10B981',
  comment: '#6366F1',
  noise: '#EF4444',
  dust: '#F59E0B',
  traffic: '#8B5CF6',
  damage: '#DC2626',
  safety: '#EF4444',
  hours: '#6366F1',
  other: '#6B7280',
}

// SVG icons for each category (centered at 24, 22)
const CATEGORY_ICONS: Record<string, string> = {
  question: `
    <circle cx="24" cy="14" r="2.5" fill="#F59E0B"/>
    <rect x="21.5" y="18" width="5" height="11" rx="2" fill="#F59E0B"/>
  `,
  negative: `
    <path d="M18 16L30 28M30 16L18 28" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/>
  `,
  positive: `
    <path d="M15 22L21 28L33 16" stroke="#10B981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  `,
  comment: `
    <circle cx="17" cy="22" r="2.5" fill="#6366F1"/>
    <circle cx="24" cy="22" r="2.5" fill="#6366F1"/>
    <circle cx="31" cy="22" r="2.5" fill="#6366F1"/>
  `,
  noise: `
    <path d="M16 19v6h4l6 5V14l-6 5h-4z" fill="#EF4444"/>
    <path d="M29 18c1.6 1 2.6 2.4 2.6 4s-1 3-2.6 4" stroke="#EF4444" stroke-width="2" fill="none" stroke-linecap="round"/>
  `,
  dust: `
    <path d="M14 18h11a3 3 0 1 0-3-3.5M14 23h15a3 3 0 1 1-3 3.5M14 28h8" stroke="#F59E0B" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  `,
  traffic: `
    <path d="M17 21l2.2-5h9.6l2.2 5" stroke="#8B5CF6" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <rect x="14.5" y="21" width="19" height="6.5" rx="2" fill="#8B5CF6"/>
    <circle cx="19" cy="29.5" r="2" fill="#8B5CF6"/>
    <circle cx="29" cy="29.5" r="2" fill="#8B5CF6"/>
  `,
  damage: `
    <path d="M14.5 22l9.5-8.5 9.5 8.5" stroke="#DC2626" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.5 22.5V30h13v-7.5" stroke="#DC2626" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
  `,
  safety: `
    <path d="M24 12.5l10 17.5H14l10-17.5z" stroke="#EF4444" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <rect x="22.9" y="19.5" width="2.2" height="6" rx="1.1" fill="#EF4444"/>
    <circle cx="24" cy="27.6" r="1.4" fill="#EF4444"/>
  `,
  hours: `
    <circle cx="24" cy="22" r="8.5" stroke="#6366F1" stroke-width="2.5" fill="none"/>
    <path d="M24 16.5V22l3.8 2.4" stroke="#6366F1" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  `,
  other: `
    <circle cx="17" cy="22" r="2.5" fill="#6B7280"/>
    <circle cx="24" cy="22" r="2.5" fill="#6B7280"/>
    <circle cx="31" cy="22" r="2.5" fill="#6B7280"/>
  `,
}

function createPinIcon(category: string, isHovered: boolean = false, resolved: boolean = false): google.maps.Icon {
  const bodyBase = PIN_COLORS[category] || PIN_COLORS.question
  const iconSvg = CATEGORY_ICONS[category] || CATEGORY_ICONS.question

  const shadowBlur = isHovered ? '3' : '2'
  const shadowOpacity = isHovered ? '0.3' : '0.25'

  // Resolved issue reports keep their category glyph but turn green with a
  // check badge, so the public map reads as a you-said-we-did log.
  const bodyColor = resolved ? '#16a34a' : bodyBase
  const resolvedBadge = resolved
    ? `<circle cx="38" cy="9" r="7.5" fill="#16a34a" stroke="white" stroke-width="2"/>
       <path d="M34.5 9l2.4 2.4 4.6-4.6" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''

  const svg = `
    <svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="${shadowBlur}" flood-color="#000000" flood-opacity="${shadowOpacity}"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill="${bodyColor}"/>
        <circle cx="24" cy="22" r="14" fill="white"/>
        ${iconSvg}
        ${resolvedBadge}
      </g>
    </svg>
  `

  const size = isHovered ? 48 : 44
  const height = isHovered ? 58 : 53

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height)
  }
}

// Module-level cache for marker icons keyed by (category|hovered|resolved).
// google.maps.Icon objects are only created once loaded; the cache avoids
// building a fresh object (and triggering setIcon churn) on every render.
const pinIconCache = new Map<string, google.maps.Icon>()

export function getPinIcon(category: string, isHovered: boolean = false, resolved: boolean = false): google.maps.Icon {
  const key = `${category}|${isHovered ? 'h' : 'n'}|${resolved ? 'r' : 'o'}`
  const cached = pinIconCache.get(key)
  if (cached) return cached
  const icon = createPinIcon(category, isHovered, resolved)
  pinIconCache.set(key, icon)
  return icon
}

// Purple dashed pin: a submission awaiting moderation.
export function createPendingPinIcon(): google.maps.Icon {
  const svg = `
    <svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pendingShadow" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#7C3AED" flood-opacity="0.4"/>
        </filter>
      </defs>
      <g filter="url(#pendingShadow)">
        <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill="#8B5CF6" stroke="white" stroke-width="2" stroke-dasharray="5 3"/>
        <circle cx="24" cy="22" r="10" fill="white"/>
        <circle cx="24" cy="22" r="5" fill="#8B5CF6"/>
      </g>
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(44, 53),
    anchor: new google.maps.Point(22, 53)
  }
}

// Get category color with opacity for shapes
export function getCategoryColor(category: string, opacity: number = 1): string {
  const feedbackColors: Record<string, string> = {
    question: `rgba(245, 158, 11, ${opacity})`,
    negative: `rgba(239, 68, 68, ${opacity})`,
    positive: `rgba(16, 185, 129, ${opacity})`,
    comment: `rgba(99, 102, 241, ${opacity})`,
    // Issue categories
    noise: `rgba(239, 68, 68, ${opacity})`,
    dust: `rgba(245, 158, 11, ${opacity})`,
    traffic: `rgba(139, 92, 246, ${opacity})`,
    damage: `rgba(220, 38, 38, ${opacity})`,
    safety: `rgba(239, 68, 68, ${opacity})`,
    hours: `rgba(99, 102, 241, ${opacity})`,
    other: `rgba(107, 114, 128, ${opacity})`,
  }
  return feedbackColors[category] || feedbackColors.comment
}

// ---- tour stops --------------------------------------------------------------

/**
 * A tour stop drawn as the same pin as feedback (body, white head, glyph), in
 * the project colour, with the stop's icon or its number in the head.
 * `iconPath` is a TOUR_STOP_ICON_PATHS glyph (authored centred on 18,16).
 * Pure string — safe before the Maps API loads (used as an <img> in the embed).
 */
export function tourStopPinSvg(color: string, glyph: { iconPath?: string | null; number?: number | string }): string {
  const content = glyph.iconPath
    // Scale the 24px glyph box to fill the head (centre 24,22), recoloured
    ? `<g transform="translate(10.5 10) scale(0.75)"><path d="${glyph.iconPath}" fill="${color}"/></g>`
    : `<text x="24" y="27.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${String(glyph.number ?? '').length > 1 ? 14 : 16}" font-weight="700" fill="${color}">${glyph.number ?? ''}</text>`
  return `<svg width="48" height="58" viewBox="0 0 48 58" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="stopShadow" x="-30%" y="-20%" width="160%" height="150%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.25"/>
    </filter></defs>
    <g filter="url(#stopShadow)">
      <path d="M24 2C12.95 2 4 10.95 4 22c0 14.25 20 32 20 32s20-17.75 20-32c0-11.05-8.95-20-20-20z" fill="${color}"/>
      <circle cx="24" cy="22" r="14" fill="white"/>
      ${content}
    </g>
  </svg>`
}

export const tourStopPinUrl = (color: string, glyph: { iconPath?: string | null; number?: number | string }) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(tourStopPinSvg(color, glyph))}`

// ---- plan layers -------------------------------------------------------------

/**
 * A plan's line marker: the pin's white head on its own, rimmed in the layer
 * colour, with the layer's glyph (e.g. a walker on a public right of way).
 * Pure string — safe before the Maps API loads (also used in the map key).
 */
export function planBadgeSvg(color: string, iconPath: string): string {
  return `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-color="#000000" flood-opacity="0.3"/>
    </filter></defs>
    <g filter="url(#badgeShadow)">
      <circle cx="14" cy="14" r="11.5" fill="white" stroke="${color}" stroke-width="2.5"/>
      <g transform="translate(14 14) scale(0.68) translate(-18 -16)"><path d="${iconPath}" fill="${color}"/></g>
    </g>
  </svg>`
}

export const planBadgeUrl = (color: string, iconPath: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(planBadgeSvg(color, iconPath))}`

const planIconCache = new Map<string, google.maps.Icon>()

/**
 * Plan-layer icons as google.maps.Icons, cached so markers keep a stable icon:
 * points (access, substation…) are the tour-stop pin in the layer colour, a
 * little smaller than feedback pins so the plan stays legible; lines get the
 * round badge, centred on the line.
 */
export function planLayerIcon(kind: 'point' | 'badge', color: string, iconPath: string, selected = false): google.maps.Icon {
  const key = `${kind}|${color}|${selected ? 's' : 'n'}|${iconPath}`
  const cached = planIconCache.get(key)
  if (cached) return cached
  let icon: google.maps.Icon
  if (kind === 'point') {
    const width = selected ? 42 : 36
    const height = Math.round(width * 58 / 48)
    icon = { url: tourStopPinUrl(color, { iconPath }), scaledSize: new google.maps.Size(width, height), anchor: new google.maps.Point(width / 2, height) }
  } else {
    const size = selected ? 32 : 26
    icon = { url: planBadgeUrl(color, iconPath), scaledSize: new google.maps.Size(size, size), anchor: new google.maps.Point(size / 2, size / 2) }
  }
  planIconCache.set(key, icon)
  return icon
}

/** Tour stop pin as a google.maps.Icon (feedback pin size, larger when hovered). */
export function tourStopPinIcon(color: string, glyph: { iconPath?: string | null; number?: number | string }, isHovered = false): google.maps.Icon {
  const size = isHovered ? 48 : 44
  const height = isHovered ? 58 : 53
  return {
    url: tourStopPinUrl(color, glyph),
    scaledSize: new google.maps.Size(size, height),
    anchor: new google.maps.Point(size / 2, height),
  }
}
