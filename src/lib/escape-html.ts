/**
 * Escape a value for safe interpolation into an HTML string (e.g. email
 * templates). Prevents HTML/script injection from user-submitted content.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape HTML but preserve author-intended line breaks by converting newlines
 * to <br/>. Use for multi-line free text (e.g. an enquiry message body).
 */
export function escapeHtmlWithBreaks(value: unknown): string {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>')
}
