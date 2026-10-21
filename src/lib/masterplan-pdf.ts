import type { PDFDocumentProxy } from 'pdfjs-dist'
import { frameRect, readGeoFrames, type GeoFrame } from './geopdf'
import { dominantColor } from './layer-key'

// Browser-side rendering of a masterplan PDF into a map overlay image. The
// PDF's own layers (optional content groups) are kept: GIS exports put the
// Ordnance Survey / aerial basemap in its own layer, and switching that off
// leaves just the proposals on a transparent background, so they sit over
// Google's map instead of a second basemap.

export interface PdfLayer {
  id: string
  name: string
  /** Shown in the rendered overlay. */
  visible: boolean
}

export interface MasterplanPdf {
  doc: PDFDocumentProxy
  bytes: ArrayBuffer
  pageCount: number
  layers: PdfLayer[]
}

// Layer names GIS tools give basemaps and drawing furniture.
const BASEMAP_LAYER_RE = /^(image|imagery|basemap|base ?map|aerial|ortho|os[ _]|ordnance|opendata|raster|tile|measured grid|grid|graticule|world[ _])/i

/** Upload ceiling (the upload route takes up to 4 MB). */
const MAX_BYTES = 3.8 * 1024 * 1024
/** Longest side of the rendered image, before any size-driven downscale. */
const TARGET_PIXELS = 4000

async function pdfjs() {
  const lib = await import('pdfjs-dist')
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  }
  return lib
}

export function isBasemapLayer(name: string): boolean {
  return BASEMAP_LAYER_RE.test(name.trim())
}

export async function loadMasterplanPdf(file: File): Promise<MasterplanPdf> {
  const bytes = await file.arrayBuffer()
  const lib = await pdfjs()
  // pdf.js transfers its buffer to the worker, so give it a copy.
  const doc = await lib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
  const config = await doc.getOptionalContentConfig()
  const layers: PdfLayer[] = []
  for (const [id, group] of Array.from(config)) {
    const name = (group.name ?? '').trim()
    if (!name) continue
    layers.push({ id, name, visible: group.visible && !isBasemapLayer(name) })
  }
  return { doc, bytes, pageCount: doc.numPages, layers }
}

/** Georeferenced map frames on a page (1-based), largest first; empty if none. */
export async function pageFrames(pdf: MasterplanPdf, pageNumber: number): Promise<GeoFrame[]> {
  return readGeoFrames(pdf.bytes, pageNumber - 1).catch(() => [])
}

/**
 * Render the overlay image: the georeferenced map frame when there is one
 * (so its corners match the frame's coordinates exactly), otherwise the
 * whole page. Hidden layers are switched off and the background is left
 * transparent. Scales down until the image fits the upload limit.
 */
type Crop = { left: number; right: number; bottom: number; top: number }

function cropFor(pdf: MasterplanPdf, page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>, frame: GeoFrame | null): Crop {
  if (frame) return frameRect(frame)
  const [x1, y1, x2, y2] = page.view
  return { left: Math.min(x1, x2), right: Math.max(x1, x2), bottom: Math.min(y1, y2), top: Math.max(y1, y2) }
}

/** Render the crop at `scale` with exactly `visible` layers on, to a fresh canvas. */
async function renderCrop(
  pdf: MasterplanPdf,
  page: Awaited<ReturnType<PDFDocumentProxy['getPage']>>,
  crop: Crop,
  scale: number,
  visible: Set<string>,
): Promise<HTMLCanvasElement> {
  const config = await pdf.doc.getOptionalContentConfig()
  for (const layer of pdf.layers) config.setVisibility(layer.id, visible.has(layer.id))
  const viewport = page.getViewport({ scale })
  const [ax, ay] = viewport.convertToViewportPoint(crop.left, crop.top)
  const [bx, by] = viewport.convertToViewportPoint(crop.right, crop.bottom)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(Math.abs(bx - ax))
  canvas.height = Math.round(Math.abs(by - ay))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser')
  // Render only the crop: shift the page so the frame's corner is at the origin.
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [1, 0, 0, 1, -Math.min(ax, bx), -Math.min(ay, by)],
    optionalContentConfigPromise: Promise.resolve(config),
    background: 'rgba(0,0,0,0)',
  }).promise
  return canvas
}

/** WebP where the browser can encode it (a fraction of PNG's size for line art), else PNG. */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.92))
  if (webp && webp.type === 'image/webp') return webp
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
}

/** Anti-aliased edges shift slightly between renders; only clear changes count as a layer's pixels. */
const DIFF_THRESHOLD = 32

export interface RenderedImage {
  blob: Blob
  width: number
  height: number
  /** Key swatch: the most common drawn colour. */
  color: string | null
  /** Fraction of pixels drawn (sampled). */
  coverage: number
}

function describe(canvas: HTMLCanvasElement, blob: Blob): RenderedImage {
  const context = canvas.getContext('2d')!
  const sample = dominantColor(context.getImageData(0, 0, canvas.width, canvas.height).data, 8)
  return { blob, width: canvas.width, height: canvas.height, color: sample?.hex ?? null, coverage: sample?.coverage ?? 0 }
}

/**
 * Render the overlay image: the georeferenced map frame when there is one
 * (so its corners match the frame's coordinates exactly), otherwise the
 * whole page. Hidden layers are switched off and the background is left
 * transparent. Scales down until the image fits the upload limit.
 */
export async function renderMasterplan(
  pdf: MasterplanPdf,
  options: { pageNumber: number; visibleLayerIds: Set<string>; frame: GeoFrame | null; maxPixels?: number },
): Promise<RenderedImage> {
  const page = await pdf.doc.getPage(options.pageNumber)
  const crop = cropFor(pdf, page, options.frame)
  const cropPoints = Math.max(crop.right - crop.left, crop.top - crop.bottom)
  let scale = Math.min((options.maxPixels ?? TARGET_PIXELS) / cropPoints, 6)
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = await renderCrop(pdf, page, crop, scale, options.visibleLayerIds)
    const blob = await encode(canvas)
    if (blob && blob.size <= MAX_BYTES) return describe(canvas, blob)
    scale *= 0.75
  }
  throw new Error('This plan is too detailed to fit the 4 MB overlay limit')
}

/**
 * Split a plan into one image per layer. GIS exports often tag content with
 * both its layer and a parent "data frame" group, so a layer shown on its own
 * draws nothing. Instead each layer is isolated by difference: the plan with
 * every selected layer, minus the plan with this one layer hidden. Pixels that
 * change belong to the layer. A "layer" whose removal blanks (nearly) the whole
 * plan is a container group, reported with `container: true` so it can be skipped.
 */
export async function createLayerSplitter(
  pdf: MasterplanPdf,
  options: { pageNumber: number; visibleLayerIds: Set<string>; frame: GeoFrame | null; maxPixels?: number },
) {
  const page = await pdf.doc.getPage(options.pageNumber)
  const crop = cropFor(pdf, page, options.frame)
  const cropPoints = Math.max(crop.right - crop.left, crop.top - crop.bottom)
  const scale = Math.min((options.maxPixels ?? TARGET_PIXELS) / cropPoints, 6)
  const baseline = await renderCrop(pdf, page, crop, scale, options.visibleLayerIds)
  const base = baseline.getContext('2d')!.getImageData(0, 0, baseline.width, baseline.height)
  let baseDrawn = 0
  for (let i = 3; i < base.data.length; i += 4) if (base.data[i] > 0) baseDrawn++

  return {
    width: baseline.width,
    height: baseline.height,
    async renderLayer(layerId: string): Promise<RenderedImage & { container: boolean; drawnPixels: number }> {
      const without = new Set(options.visibleLayerIds)
      without.delete(layerId)
      const other = await renderCrop(pdf, page, crop, scale, without)
      const o = other.getContext('2d')!.getImageData(0, 0, other.width, other.height).data
      const out = new ImageData(baseline.width, baseline.height)
      const b = base.data, d = out.data
      let drawn = 0
      for (let i = 0; i < b.length; i += 4) {
        const delta = Math.max(Math.abs(b[i] - o[i]), Math.abs(b[i + 1] - o[i + 1]), Math.abs(b[i + 2] - o[i + 2]), Math.abs(b[i + 3] - o[i + 3]))
        if (delta >= DIFF_THRESHOLD && b[i + 3] > 0) {
          d[i] = b[i]; d[i + 1] = b[i + 1]; d[i + 2] = b[i + 2]; d[i + 3] = b[i + 3]
          drawn++
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = baseline.width
      canvas.height = baseline.height
      canvas.getContext('2d')!.putImageData(out, 0, 0)
      const blob = await encode(canvas)
      if (!blob) throw new Error('Could not encode layer image')
      if (blob.size > MAX_BYTES) throw new Error('A layer image is too detailed to fit the 4 MB overlay limit')
      return { ...describe(canvas, blob), container: baseDrawn > 0 && drawn / baseDrawn > 0.9, drawnPixels: drawn }
    },
  }
}
