import type { PDFDocumentProxy } from 'pdfjs-dist'
import { frameRect, readGeoFrames, type GeoFrame } from './geopdf'

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
export async function renderMasterplan(
  pdf: MasterplanPdf,
  options: { pageNumber: number; visibleLayerIds: Set<string>; frame: GeoFrame | null; maxPixels?: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdf.doc.getPage(options.pageNumber)
  const config = await pdf.doc.getOptionalContentConfig()
  for (const layer of pdf.layers) config.setVisibility(layer.id, options.visibleLayerIds.has(layer.id))

  let cropPdf: { left: number; right: number; bottom: number; top: number }
  if (options.frame) {
    cropPdf = frameRect(options.frame)
  } else {
    const [x1, y1, x2, y2] = page.view
    cropPdf = { left: Math.min(x1, x2), right: Math.max(x1, x2), bottom: Math.min(y1, y2), top: Math.max(y1, y2) }
  }
  const cropPoints = Math.max(cropPdf.right - cropPdf.left, cropPdf.top - cropPdf.bottom)
  let scale = Math.min((options.maxPixels ?? TARGET_PIXELS) / cropPoints, 6)

  for (let attempt = 0; attempt < 5; attempt++) {
    const viewport = page.getViewport({ scale })
    const [ax, ay] = viewport.convertToViewportPoint(cropPdf.left, cropPdf.top)
    const [bx, by] = viewport.convertToViewportPoint(cropPdf.right, cropPdf.bottom)
    const sx = Math.min(ax, bx), sy = Math.min(ay, by)
    const width = Math.round(Math.abs(bx - ax))
    const height = Math.round(Math.abs(by - ay))

    // Render only the crop: shift the page so the frame's corner is at the origin.
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available in this browser')
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
      transform: [1, 0, 0, 1, -sx, -sy],
      optionalContentConfigPromise: Promise.resolve(config),
      background: 'rgba(0,0,0,0)',
    }).promise

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (blob && blob.size <= MAX_BYTES) return { blob, width, height }
    scale *= 0.75
  }
  throw new Error('This plan is too detailed to fit the 4 MB overlay limit')
}
