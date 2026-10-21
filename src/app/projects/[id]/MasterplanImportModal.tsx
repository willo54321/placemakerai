'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, MapPinned, AlertCircle } from 'lucide-react'
import { ModalShell } from '@/components/ModalShell'
import { Spinner } from '@/components/Spinner'
import { frameCorners, overlayFromCorners, type GeoFrame } from '@/lib/geopdf'
import { createLayerSplitter, loadMasterplanPdf, pageFrames, renderMasterplan, type MasterplanPdf } from '@/lib/masterplan-pdf'
import { cleanLayerName } from '@/lib/layer-key'

export interface ImportedOverlay {
  name: string
  imageUrl: string
  bounds: [[number, number], [number, number]]
  rotation: number
  georeferenced: boolean
  /** Key swatch when imported as an individual plan layer. */
  color: string | null
}

type Mode = 'single' | 'layers'

// Drawing furniture GIS exports put in their own groups; off by default when
// importing as layers (still listed, so they can be switched back on).
const FURNITURE_RE = /^(other( \d+)?|<default>|measured grid|grid|image|text - .*label)$/i
/** Fewer drawn pixels than this is edge noise, not a layer. */
const MIN_LAYER_PIXELS = 60

/** Longest side for per-layer images: visitors load one per layer, so smaller than a single plan. */
const LAYER_PIXELS = 2600

async function upload(blob: Blob, name: string): Promise<string> {
  const formData = new FormData()
  const ext = blob.type === 'image/webp' ? 'webp' : 'png'
  formData.append('file', new File([blob], `${name}.${ext}`, { type: blob.type || 'image/png' }))
  const res = await fetch('/api/upload', { method: 'POST', body: formData })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Upload failed')
  return body.url
}

// Turns a masterplan PDF into map overlays. A georeferenced PDF (ArcGIS/QGIS
// export) is placed exactly from its embedded coordinates; anything else is
// placed by `fallbackBounds` for the admin to position by hand. A PDF with
// drawing layers can be imported as one overlay per layer, each with a key
// swatch, so visitors can switch parts of the plan on and off.
export function MasterplanImportModal({
  file, onClose, onImported, fallbackBounds,
}: {
  file: File
  onClose: () => void
  onImported: (overlays: ImportedOverlay[]) => void
  /** Initial placement for a PDF without coordinates, given its width/height ratio. */
  fallbackBounds: (aspect: number) => [[number, number], [number, number]]
}) {
  const [pdf, setPdf] = useState<MasterplanPdf | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [frame, setFrame] = useState<GeoFrame | null>(null)
  const [framesLoaded, setFramesLoaded] = useState(false)
  const [visible, setVisible] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>('single')
  const [preview, setPreview] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadMasterplanPdf(file)
      .then(loaded => {
        if (cancelled) return
        setPdf(loaded)
        // A layered GIS export is the case a toggleable key is for
        const layers = loaded.layers.length >= 2
        setMode(layers ? 'layers' : 'single')
        setVisible(new Set(loaded.layers.filter(l => l.visible && !(layers && FURNITURE_RE.test(l.name.trim()))).map(l => l.id)))
      })
      .catch(err => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not read this PDF') })
    return () => { cancelled = true }
  }, [file])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    pageFrames(pdf, pageNumber).then(frames => {
      if (cancelled) return
      setFrame(frames[0] ?? null)
      setFramesLoaded(true)
    })
    return () => { cancelled = true }
  }, [pdf, pageNumber])

  // Low-resolution preview of exactly what will be added.
  useEffect(() => {
    if (!pdf || !framesLoaded) return
    let cancelled = false
    let url: string | null = null
    renderMasterplan(pdf, { pageNumber, visibleLayerIds: visible, frame, maxPixels: 900 })
      .then(({ blob }) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => { if (!cancelled) setPreview(null) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [pdf, framesLoaded, pageNumber, visible, frame])

  const placement = useMemo(() => {
    if (!frame) return null
    try {
      return overlayFromCorners(frameCorners(frame))
    } catch {
      return null
    }
  }, [frame])

  const toggleLayer = (id: string) => {
    setVisible(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedLayers = pdf ? pdf.layers.filter(l => visible.has(l.id)) : []
  const layerMode = mode === 'layers' && selectedLayers.length > 0

  const addToMap = async () => {
    if (!pdf) return
    setImporting(true)
    setImportError(null)
    const planName = file.name.replace(/\.pdf$/i, '')
    const place = (width: number, height: number) => ({
      bounds: placement?.bounds ?? fallbackBounds(width / height),
      rotation: placement?.rotation ?? 0,
      georeferenced: Boolean(placement),
    })
    try {
      if (!layerMode) {
        const { blob, width, height } = await renderMasterplan(pdf, { pageNumber, visibleLayerIds: visible, frame: placement ? frame : null })
        const imageUrl = await upload(blob, planName)
        onImported([{ name: planName, imageUrl, color: null, ...place(width, height) }])
        return
      }
      // One overlay per layer, all sharing the frame's placement, created
      // bottom-to-top (the PDF lists the top layer first) so later layers draw
      // over earlier ones as in the plan. Empty layers and container groups
      // are skipped.
      const overlays: ImportedOverlay[] = []
      const splitter = await createLayerSplitter(pdf, { pageNumber, visibleLayerIds: visible, frame: placement ? frame : null, maxPixels: LAYER_PIXELS })
      const ordered = [...selectedLayers].reverse()
      for (let i = 0; i < ordered.length; i++) {
        const layer = ordered[i]
        const name = cleanLayerName(layer.name)
        setProgress({ done: i, total: ordered.length, name })
        const { blob, width, height, color, container, drawnPixels } = await splitter.renderLayer(layer.id)
        if (drawnPixels < MIN_LAYER_PIXELS || container) continue
        const imageUrl = await upload(blob, `${planName} - ${name}`)
        overlays.push({ name, imageUrl, color, ...place(width, height) })
      }
      if (overlays.length === 0) throw new Error('None of the selected layers draw anything on this page')
      onImported(overlays)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not add this plan')
      setImporting(false)
      setProgress(null)
    }
  }

  return (
    <ModalShell onClose={importing ? () => {} : onClose} label="Import masterplan">
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">Import masterplan</h3>
            <p className="text-sm text-slate-500 truncate">{file.name}</p>
          </div>
          <button onClick={onClose} disabled={importing} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loadError ? (
          <p className="text-sm text-red-600 flex items-center gap-2"><AlertCircle size={16} /> {loadError}</p>
        ) : !pdf ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : (
          <>
            {pdf.pageCount > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Page
                <select
                  value={pageNumber}
                  onChange={e => { setFramesLoaded(false); setPageNumber(Number(e.target.value)) }}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                >
                  {Array.from({ length: pdf.pageCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </label>
            )}

            {framesLoaded && (
              placement ? (
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <MapPinned size={16} aria-hidden="true" />
                  Georeferenced — it will be placed automatically.
                </p>
              ) : (
                <p className="text-sm text-amber-700 flex items-center gap-2">
                  <AlertCircle size={16} aria-hidden="true" />
                  No map coordinates in this PDF — position it on the map after adding.
                </p>
              )
            )}

            <div className="rounded-lg border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px] min-h-[160px] flex items-center justify-center overflow-hidden">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview of the overlay" className="max-h-72 w-auto" />
              ) : (
                <Spinner />
              )}
            </div>

            {pdf.layers.length >= 2 && (
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm" role="radiogroup" aria-label="Import as">
                {([['layers', 'Layers you can switch on and off'], ['single', 'One image']] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={mode === id}
                    onClick={() => setMode(id)}
                    className={`flex-1 rounded-md px-3 py-1.5 transition-colors ${mode === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {pdf.layers.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium text-slate-700 mb-1.5">Layers</legend>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {pdf.layers.map(layer => (
                    <label key={layer.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={visible.has(layer.id)}
                        onChange={() => toggleLayer(layer.id)}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="truncate">{mode === 'layers' ? cleanLayerName(layer.name) : layer.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {importError && <p className="text-sm text-red-600">{importError}</p>}
            {progress && (
              <p className="text-sm text-slate-500">Rendering {progress.done + 1} of {progress.total}: {progress.name}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={importing} className="btn-secondary">Cancel</button>
              <button type="button" onClick={addToMap} disabled={importing || !framesLoaded} className="btn-primary flex items-center gap-2">
                {importing && <Spinner size="sm" />}
                {layerMode ? `Add ${selectedLayers.length} layer${selectedLayers.length === 1 ? '' : 's'} to map` : 'Add to map'}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
