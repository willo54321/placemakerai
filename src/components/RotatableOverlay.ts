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

export interface IRotatableOverlay {
  setMap(map: google.maps.Map | null): void
  setBounds(bounds: [[number, number], [number, number]]): void
  setRotation(rotation: number): void
  setOpacity(opacity: number): void
  setImageUrl(imageUrl: string): void
  getBounds(): [[number, number], [number, number]]
  getRotation(): number
  getOpacity(): number
  getCenter(): { lat: number; lng: number }
}

/**
 * Factory class that wraps the actual OverlayView implementation.
 * This avoids the "google is not defined" error by only accessing
 * google.maps.OverlayView when methods are called (after Maps API has loaded).
 */
export class RotatableOverlay implements IRotatableOverlay {
  private overlay: google.maps.OverlayView | null = null
  private options: RotatableOverlayOptions
  private _bounds: [[number, number], [number, number]]
  private _rotation: number
  private _opacity: number
  private _imageUrl: string

  constructor(options: RotatableOverlayOptions) {
    this.options = options
    this._bounds = options.bounds
    this._rotation = options.rotation
    this._opacity = options.opacity
    this._imageUrl = options.imageUrl
  }

  private createOverlay(): google.maps.OverlayView {
    const self = this
    const options = this.options

    class InternalOverlay extends google.maps.OverlayView {
      private div: HTMLDivElement | null = null
      private image: HTMLImageElement | null = null

      onAdd(): void {
        this.div = document.createElement('div')
        this.div.style.position = 'absolute'
        this.div.style.transformOrigin = 'center center'
        this.div.style.pointerEvents = (options.clickable ?? true) ? 'auto' : 'none'
        this.div.style.cursor = (options.clickable ?? true) ? 'pointer' : 'default'

        this.image = document.createElement('img')
        this.image.src = self._imageUrl
        this.image.style.width = '100%'
        this.image.style.height = '100%'
        this.image.style.display = 'block'
        this.image.style.opacity = String(self._opacity)
        this.image.draggable = false
        this.image.style.userSelect = 'none'

        this.div.appendChild(this.image)

        if ((options.clickable ?? true) && options.onClick) {
          this.div.addEventListener('click', (e) => {
            e.stopPropagation()
            options.onClick?.()
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

        const swLatLng = new google.maps.LatLng(self._bounds[0][0], self._bounds[0][1])
        const neLatLng = new google.maps.LatLng(self._bounds[1][0], self._bounds[1][1])

        const sw = overlayProjection.fromLatLngToDivPixel(swLatLng)
        const ne = overlayProjection.fromLatLngToDivPixel(neLatLng)

        if (!sw || !ne) return

        const width = Math.abs(ne.x - sw.x)
        const height = Math.abs(sw.y - ne.y)

        // Position at the top-left corner (ne.y is top, sw.x is left)
        this.div.style.left = Math.min(sw.x, ne.x) + 'px'
        this.div.style.top = Math.min(sw.y, ne.y) + 'px'
        this.div.style.width = width + 'px'
        this.div.style.height = height + 'px'
        this.div.style.transform = `rotate(${self._rotation}deg)`
      }

      onRemove(): void {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div)
          this.div = null
          this.image = null
        }
      }

      updateOpacity(opacity: number): void {
        if (this.image) {
          this.image.style.opacity = String(opacity)
        }
      }

      updateRotation(rotation: number): void {
        if (this.div) {
          this.div.style.transform = `rotate(${rotation}deg)`
        }
      }

      updateImageUrl(imageUrl: string): void {
        if (this.image) {
          this.image.src = imageUrl
        }
      }
    }

    return new InternalOverlay()
  }

  setMap(map: google.maps.Map | null): void {
    if (map && !this.overlay) {
      this.overlay = this.createOverlay()
    }
    if (this.overlay) {
      this.overlay.setMap(map)
    }
  }

  setBounds(bounds: [[number, number], [number, number]]): void {
    this._bounds = bounds
    if (this.overlay) {
      (this.overlay as any).draw()
    }
  }

  setRotation(rotation: number): void {
    this._rotation = rotation
    if (this.overlay) {
      (this.overlay as any).updateRotation(rotation)
    }
  }

  setOpacity(opacity: number): void {
    this._opacity = opacity
    if (this.overlay) {
      (this.overlay as any).updateOpacity(opacity)
    }
  }

  setImageUrl(imageUrl: string): void {
    this._imageUrl = imageUrl
    if (this.overlay) {
      (this.overlay as any).updateImageUrl(imageUrl)
    }
  }

  getBounds(): [[number, number], [number, number]] {
    return this._bounds
  }

  getRotation(): number {
    return this._rotation
  }

  getOpacity(): number {
    return this._opacity
  }

  getCenter(): { lat: number; lng: number } {
    return {
      lat: (this._bounds[0][0] + this._bounds[1][0]) / 2,
      lng: (this._bounds[0][1] + this._bounds[1][1]) / 2
    }
  }
}

/**
 * Helper function to calculate rotation angle from mouse position relative to center
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
