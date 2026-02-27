import { useState, useCallback, useRef } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { usePdfPages } from '../hooks/usePdfPages'
import { reorderPages } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'

export default function ReorderPDF() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading, loadFile, reset } = usePdfPages()
  const gridRef = useRef<HTMLDivElement>(null)

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setError(null)
      loadFile(pdf)
    }
  }, [loadFile])

  if (thumbnails.length > 0 && order.length !== thumbnails.length) {
    setOrder(thumbnails.map((_, i) => i))
  }

  const moveItem = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || toIdx < 0) return
    setOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
    return toIdx
  }, [])

  // Tap to select / deselect
  const handleTap = useCallback((visualIdx: number) => {
    setSelectedIdx((prev) => (prev === visualIdx ? null : visualIdx))
  }, [])

  // Move selected page
  const moveSelected = useCallback((direction: 'up' | 'down' | 'start' | 'end') => {
    if (selectedIdx === null) return
    const max = order.length - 1
    let target: number
    switch (direction) {
      case 'up': target = Math.max(0, selectedIdx - 1); break
      case 'down': target = Math.min(max, selectedIdx + 1); break
      case 'start': target = 0; break
      case 'end': target = max; break
    }
    moveItem(selectedIdx, target)
    setSelectedIdx(target)
  }, [selectedIdx, order.length, moveItem])

  // Desktop drag (kept for mouse users)
  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }, [])
  const handleDragLeave = useCallback(() => { setOverIdx(null) }, [])
  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx !== null) {
        moveItem(dragIdx, targetIdx)
        setSelectedIdx(targetIdx)
      }
      setDragIdx(null)
      setOverIdx(null)
    },
    [dragIdx, moveItem],
  )
  const handleDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null) }, [])

  const handleReorder = async () => {
    if (!file || order.length === 0) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await reorderPages(buffer, order)
      downloadBlob(result, `reordered-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reorder.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('reorder.title')} description={t('reorder.description')}>
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label={t('common.drop')} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm font-medium">{file.name}</span>
              <span className="text-slate-500 text-xs">{t('common.pages', { count: thumbnails.length })}</span>
            </div>
            <button
              onClick={() => { setFile(null); setOrder([]); setSelectedIdx(null); reset() }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          {/* Move controls — sticky bar when a page is selected */}
          {selectedIdx !== null && (
            <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 text-sm font-medium whitespace-nowrap">
                  Page #{order[selectedIdx] + 1} →
                </span>
                <input
                  type="number"
                  min={1}
                  max={order.length}
                  value={selectedIdx + 1}
                  onChange={(e) => {
                    const target = Math.max(0, Math.min(order.length - 1, parseInt(e.target.value, 10) - 1))
                    if (!isNaN(target)) {
                      moveItem(selectedIdx, target)
                      setSelectedIdx(target)
                    }
                  }}
                  className="w-14 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center text-sm text-white focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-slate-500 text-sm">/ {order.length}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => moveSelected('start')}
                  disabled={selectedIdx === 0}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  title={t('reorder.moveStart')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 4.5l-7 7 7 7M11.5 4.5l-7 7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSelected('up')}
                  disabled={selectedIdx === 0}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  title={t('reorder.moveBefore')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSelected('down')}
                  disabled={selectedIdx === order.length - 1}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  title={t('reorder.moveAfter')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSelected('end')}
                  disabled={selectedIdx === order.length - 1}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors"
                  title={t('reorder.moveEnd')}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 4.5l7 7-7 7M12.5 4.5l7 7-7 7" />
                  </svg>
                </button>
                <div className="w-px h-6 bg-slate-700 mx-1" />
                <button
                  onClick={() => setSelectedIdx(null)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-slate-500">{t('common.loading')}</div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {order.map((pageIdx, visualIdx) => (
                <div
                  key={`${pageIdx}-${visualIdx}`}
                  draggable
                  onClick={() => handleTap(visualIdx)}
                  onDragStart={() => handleDragStart(visualIdx)}
                  onDragOver={(e) => handleDragOver(e, visualIdx)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(visualIdx)}
                  onDragEnd={handleDragEnd}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all select-none ${
                    selectedIdx === visualIdx
                      ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.03]'
                      : dragIdx === visualIdx
                        ? 'opacity-40 border-slate-700'
                        : overIdx === visualIdx
                          ? 'border-blue-500 scale-105'
                          : 'border-slate-700 hover:border-blue-500/50'
                  }`}
                >
                  <img src={thumbnails[pageIdx]} alt={`Page ${pageIdx + 1}`} className="w-full pointer-events-none" draggable={false} />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 flex justify-between items-center">
                    <span className="text-white text-xs font-medium">#{pageIdx + 1}</span>
                    <span className="text-slate-300 text-xs">pos {visualIdx + 1}</span>
                  </div>
                  {selectedIdx === visualIdx && (
                    <div className="absolute top-1.5 right-1.5 bg-blue-500 rounded-full p-0.5">
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={handleReorder}
              disabled={processing || order.length === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing ? t('reorder.processing') : t('reorder.button')}
            </button>
            <button
              onClick={() => { setOrder(thumbnails.map((_, i) => i)); setSelectedIdx(null) }}
              className="px-4 py-3 text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('reorder.reset')}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
