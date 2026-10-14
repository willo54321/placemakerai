// Per-project styling for the standalone form embeds (enquiry, signup), using
// the same defaults as the map embed so all surfaces match on a client site.
export const DEFAULT_EMBED_FONT = 'DM Sans'
export const DEFAULT_EMBED_COLOR = '#10B981'

export interface EmbedTheme {
  primaryColor: string
  fontFamily: string
  fontUrl: string
}

export function embedTheme(project: { embedPrimaryColor: string | null; embedFontFamily: string | null }): EmbedTheme {
  // Only accept hex colours — the value ends up in a CSS custom property.
  const primaryColor = project.embedPrimaryColor && /^#[0-9a-fA-F]{3,8}$/.test(project.embedPrimaryColor)
    ? project.embedPrimaryColor
    : DEFAULT_EMBED_COLOR
  const fontFamily = project.embedFontFamily?.trim() || DEFAULT_EMBED_FONT
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  return { primaryColor, fontFamily, fontUrl }
}
