// Several plan layers that share one footprint (a masterplan imported layer by
// layer) are drawn into a single canvas and placed on the map as one overlay.
// The map then moves one texture per frame instead of one per layer, which is
// the difference between a smooth camera flight and a stuttering one.
// Toggling a layer just redraws the canvas.

export interface StackLayer {
  id: string
  imageUrl: string
  opacity: number
}

export class OverlayStack {
  readonly canvas = document.createElement('canvas')
  private images = new Map<string, HTMLImageElement>()
  private layers: StackLayer[] = []
  private disposed = false

  setLayers(layers: StackLayer[]): void {
    this.layers = layers
    for (const layer of layers) {
      if (this.images.has(layer.imageUrl)) continue
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => this.redraw()
      img.src = layer.imageUrl
      this.images.set(layer.imageUrl, img)
    }
    this.redraw()
  }

  /** Highest opacity among the layers; drawn per layer, so the overlay itself stays at 1. */
  private redraw(): void {
    if (this.disposed) return
    const loaded = this.layers.map(l => ({ layer: l, img: this.images.get(l.imageUrl) })).filter(x => x.img?.complete && x.img.naturalWidth > 0)
    const width = Math.max(1, ...loaded.map(x => x.img!.naturalWidth))
    const height = Math.max(1, ...loaded.map(x => x.img!.naturalHeight))
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    for (const { layer, img } of loaded) {
      ctx.globalAlpha = layer.opacity
      ctx.drawImage(img!, 0, 0, width, height)
    }
    ctx.globalAlpha = 1
  }

  dispose(): void {
    this.disposed = true
    this.images.forEach(img => { img.onload = null })
    this.images.clear()
  }
}

/** Overlays sharing exactly the same footprint are stacked; anything else stands alone. */
export function footprintKey(o: { bounds: [[number, number], [number, number]]; rotation: number }): string {
  const r = (n: number) => n.toFixed(7)
  return `${r(o.bounds[0][0])},${r(o.bounds[0][1])},${r(o.bounds[1][0])},${r(o.bounds[1][1])},${r(o.rotation || 0)}`
}
