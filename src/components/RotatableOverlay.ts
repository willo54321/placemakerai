/**
 * RotatableOverlay - A custom Google Maps overlay that supports rotation
 *
 * Google Maps GroundOverlay doesn't support rotation, so we create a custom
 * OverlayView that uses CSS transforms to rotate the image.
 */

export interface RotatableOverlayOptions {
  imageUrl: string
  bounds: [[number, number], [number, number]] // [[southLat, westLng], [northLat, eastLng]]
  rotation: number // Degrees (0-360)
  opacity: number
  clickable?: boolean
  onClick?: () => void
}

export class RotatableOverlay extends google.maps.OverlayView {
  private div: HTMLDivElement | null = null
  private imageUrl: string
  private bounds: [[number, number], [number, number]]
  private rotation: number
  private opacity: number
  private clickable: boolean
  private onClick?: () => void
  private image: HTMLImageElement | null = null

  constructor(options: RotatableOverlayOptions) {
    super()
    this.imageUrl = options.imageUrl
    this.bounds = options.bounds
    this.rotation = options.rotation
    this.opacity = options.opacity
    this.clickable = options.clickable ?? true
    this.onClick = options.onClick
  }

  onAdd(): void {
    this.div = document.createElement('div')
    this.div.style.position = 'absolute'
    this.div.style.transformOrigin = 'center center'
    this.div.style.pointerEvents = this.clickable ? 'auto' : 'none'
    this.div.style.cursor = this.clickable ? 'pointer' : 'default'

    this.image = document.createElement('img')
    this.image.src = this.imageUrl
    this.image.style.width = '100%'
    this.image.style.height = '100%'
    this.image.style.display = 'block'
    this.image.style.opacity = String(this.opacity)
    this.image.draggable = false
    this.image.style.userSelect = 'none'

    this.div.appendChild(this.image)

    if (this.clickable && this.onClick) {
      this.div.addEventListener('click', (e) => {
        e.stopPropagation()
        this.onClick?.()
      })
    }

    const panes = this.getPanes()
    if (panes) {
      panes.overlayLayer.appendChild(this.div)
    }
  }

  draw(): void {
    if (!this.div) return

    const overlayProjection = this.getProjection()
    if (!overlayProjection) return

    // Convert lat/lng bounds to pixel positions
    const sw = overlayProjection.fromLatLngToDivPixel(
      new google.maps.LatLng(this.bounds[0][0], this.bounds[0][1])
    )
    const ne = overlayProjection.fromLatLngToDivPixel(
      new google.maps.LatLng(this.bounds[1][0], this.bounds[1][1])
    )

    if (!sw || !ne) return

    // Calculate dimensions
    const width = ne.x - sw.x
    const height = sw.y - ne.y

    // Position the div
    this.div.style.left = sw.x + 'px'
    this.div.style.top = ne.y + 'px'
    this.div.style.width = width + 'px'
    this.div.style.height = height + 'px'

    // Apply rotation
    this.div.style.transform = `rotate(${this.rotation}deg)`
  }

  onRemove(): void {
    if (this.div) {
      this.div.parentNode?.removeChild(this.div)
      this.div = null
      this.image = null
    }
  }

  // Update methods
  setBounds(bounds: [[number, number], [number, number]]): void {
    this.bounds = bounds
    this.draw()
  }

  setRotation(rotation: number): void {
    this.rotation = rotation
    if (this.div) {
      this.div.style.transform = `rotate(${rotation}deg)`
    }
  }

  setOpacity(opacity: number): void {
    this.opacity = opacity
    if (this.image) {
      this.image.style.opacity = String(opacity)
    }
  }

  setImageUrl(imageUrl: string): void {
    this.imageUrl = imageUrl
    if (this.image) {
      this.image.src = imageUrl
    }
  }

  // Getters
  getBounds(): [[number, number], [number, number]] {
    return this.bounds
  }

  getRotation(): number {
    return this.rotation
  }

  getOpacity(): number {
    return this.opacity
  }

  /**
   * Get the center point of the overlay in lat/lng
   */
  getCenter(): { lat: number; lng: number } {
    return {
      lat: (this.bounds[0][0] + this.bounds[1][0]) / 2,
      lng: (this.bounds[0][1] + this.bounds[1][1]) / 2
    }
  }

  /**
   * Calculate rotated corner positions for display
   * This is useful for showing where the corners actually appear after rotation
   */
  getRotatedCorners(): { sw: google.maps.LatLng; nw: google.maps.LatLng; ne: google.maps.LatLng; se: google.maps.LatLng } | null {
    const projection = this.getProjection()
    if (!projection) return null

    const center = this.getCenter()
    const centerPixel = projection.fromLatLngToDivPixel(new google.maps.LatLng(center.lat, center.lng))
    if (!centerPixel) return null

    // Original corner positions in pixels
    const sw = projection.fromLatLngToDivPixel(new google.maps.LatLng(this.bounds[0][0], this.bounds[0][1]))
    const ne = projection.fromLatLngToDivPixel(new google.maps.LatLng(this.bounds[1][0], this.bounds[1][1]))
    if (!sw || !ne) return null

    const nw = { x: sw.x, y: ne.y }
    const se = { x: ne.x, y: sw.y }

    // Rotate corners around center
    const rad = (this.rotation * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)

    const rotatePoint = (px: number, py: number) => {
      const dx = px - centerPixel.x
      const dy = py - centerPixel.y
      return {
        x: centerPixel.x + dx * cos - dy * sin,
        y: centerPixel.y + dx * sin + dy * cos
      }
    }

    const rotatedSW = rotatePoint(sw.x, sw.y)
    const rotatedNW = rotatePoint(nw.x, nw.y)
    const rotatedNE = rotatePoint(ne.x, ne.y)
    const rotatedSE = rotatePoint(se.x, se.y)

    // Convert back to LatLng
    return {
      sw: projection.fromDivPixelToLatLng(new google.maps.Point(rotatedSW.x, rotatedSW.y))!,
      nw: projection.fromDivPixelToLatLng(new google.maps.Point(rotatedNW.x, rotatedNW.y))!,
      ne: projection.fromDivPixelToLatLng(new google.maps.Point(rotatedNE.x, rotatedNE.y))!,
      se: projection.fromDivPixelToLatLng(new google.maps.Point(rotatedSE.x, rotatedSE.y))!
    }
  }
}

/**
 * Helper function to calculate rotation angle from mouse position relative to center
 * @param centerLat Center latitude of overlay
 * @param centerLng Center longitude of overlay
 * @param mouseLat Mouse latitude
 * @param mouseLng Mouse longitude
 * @returns Rotation angle in degrees (0-360)
 */
export function calculateRotationAngle(
  centerLat: number,
  centerLng: number,
  mouseLat: number,
  mouseLng: number
): number {
  const dx = mouseLng - centerLng
  const dy = mouseLat - centerLat
  let angle = Math.atan2(dx, dy) * (180 / Math.PI)

  // Normalize to 0-360
  if (angle < 0) {
    angle += 360
  }

  return angle
}

/**
 * Snap angle to nearest increment (e.g., 15 degrees)
 */
export function snapAngle(angle: number, increment: number = 15): number {
  return Math.round(angle / increment) * increment
}
