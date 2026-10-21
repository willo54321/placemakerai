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
      // Layout size the element was last given; everything else is a transform
      private baseWidth = 0
      private baseHeight = 0

      onAdd(): void {
        this.div = document.createElement('div')
        this.div.style.position = 'absolute'
        this.div.style.left = '0'
        this.div.style.top = '0'
        this.div.style.transformOrigin = '0 0'
        this.div.style.pointerEvents = (options.clickable ?? true) ? 'auto' : 'none'
        this.div.style.cursor = (options.clickable ?? true) ? 'pointer' : 'default'
        // Safari fixes for transform rendering
        this.div.style.isolation = 'isolate'
        ;(this.div.style as any).webkitTransformStyle = 'flat'
        this.div.style.transformStyle = 'flat'
        this.div.style.webkitBackfaceVisibility = 'hidden'
        this.div.style.backfaceVisibility = 'hidden'
        this.div.style.willChange = 'transform'

        this.image = document.createElement('img')
        this.image.src = self._imageUrl
        // Use explicit dimensions set in draw() instead of percentages for Safari
        this.image.style.display = 'block'
        this.image.style.opacity = String(self._opacity)
        this.image.draggable = false
        this.image.style.userSelect = 'none'
        this.image.style.webkitBackfaceVisibility = 'hidden'
        this.image.style.backfaceVisibility = 'hidden'

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

      // Positioned, scaled and rotated with a single transform. Changing an
      // image's width/height makes the browser re-rasterise the bitmap, which
      // with several large plan layers drops most frames of a camera flight;
      // a transform is applied by the compositor. The layout size is only
      // reset when the zoom has drifted far from it, to keep the scaled
      // bitmap sharp.
      draw(): void {
        if (!this.div || !this.image) return

        const overlayProjection = this.getProjection()
        if (!overlayProjection) return

        const sw = overlayProjection.fromLatLngToDivPixel(
          new google.maps.LatLng(self._bounds[0][0], self._bounds[0][1])
        )
        const ne = overlayProjection.fromLatLngToDivPixel(
          new google.maps.LatLng(self._bounds[1][0], self._bounds[1][1])
        )

        if (!sw || !ne) return

        const width = ne.x - sw.x
        const height = sw.y - ne.y
        if (width <= 0 || height <= 0) return

        const drift = this.baseWidth > 0 ? Math.abs(Math.log2(width / this.baseWidth)) : Infinity
        if (drift > 2) {
          this.baseWidth = width
          this.baseHeight = height
          this.div.style.width = width + 'px'
          this.div.style.height = height + 'px'
          this.image.style.width = width + 'px'
          this.image.style.height = height + 'px'
        }

        const cx = (sw.x + ne.x) / 2
        const cy = (sw.y + ne.y) / 2
        const sx = width / this.baseWidth
        const sy = height / this.baseHeight
        this.div.style.transform =
          `translate(${cx}px, ${cy}px) rotate(${self._rotation}deg) scale(${sx}, ${sy}) translate(${-this.baseWidth / 2}px, ${-this.baseHeight / 2}px)`
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

      updateRotation(): void {
        this.draw()
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
      (this.overlay as any).updateRotation()
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
