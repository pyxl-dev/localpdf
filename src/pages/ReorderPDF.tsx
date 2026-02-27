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
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading, loadFile, reset } = usePdfPages()

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

  const [overIdx, setOverIdx] = useState<number | null>(null)
  const touchState = useRef<{ startIdx: number; el: HTMLDivElement | null }>({ startIdx: -1, el: null })
  const gridRef = useRef<HTMLDivElement>(null)

  const moveItem = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return
    setOrder((prev) => {
      const next = [...prev]
      const [item] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, item)
      return next
    })
  }, [])

  // Desktop drag
  const handleDragStart = useCallback((idx: number) => { setDragIdx(idx) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault()
    setOverIdx(idx)
  }, [])
  const handleDragLeave = useCallback(() => { setOverIdx(null) }, [])
  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx !== null) moveItem(dragIdx, targetIdx)
      setDragIdx(null)
      setOverIdx(null)
    },
    [dragIdx, moveItem],
  )
  const handleDragEnd = useCallback(() => { setDragIdx(null); setOverIdx(null) }, [])

  // Mobile touch
  const getIdxFromPoint = useCallback((x: number, y: number): number | null => {
    const grid = gridRef.current
    if (!grid) return null
    const children = Array.from(grid.children) as HTMLElement[]
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return i
    }
    return null
  }, [])

  const handleTouchStart = useCallback((idx: number, e: React.TouchEvent) => {
    const el = e.currentTarget as HTMLDivElement
    touchState.current = { startIdx: idx, el }
    setDragIdx(idx)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    const target = getIdxFromPoint(touch.clientX, touch.clientY)
    setOverIdx(target)
  }, [getIdxFromPoint])

  const handleTouchEnd = useCallback(() => {
    const fromIdx = touchState.current.startIdx
    if (fromIdx >= 0 && overIdx !== null && fromIdx !== overIdx) {
      moveItem(fromIdx, overIdx)
    }
    touchState.current = { startIdx: -1, el: null }
    setDragIdx(null)
    setOverIdx(null)
  }, [overIdx, moveItem])

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
              onClick={() => { setFile(null); setOrder([]); reset() }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">{t('common.loading')}</div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {order.map((pageIdx, visualIdx) => (
                <div
                  key={`${pageIdx}-${visualIdx}`}
                  draggable
                  onDragStart={() => handleDragStart(visualIdx)}
                  onDragOver={(e) => handleDragOver(e, visualIdx)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(visualIdx)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(visualIdx, e)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`relative rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all select-none ${
                    dragIdx === visualIdx
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
              onClick={() => setOrder(thumbnails.map((_, i) => i))}
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
