import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { usePdfPages } from '../hooks/usePdfPages'
import { reorderPages } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

export default function ReorderPDF() {
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading } = usePdfPages(file)

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setError(null)
    }
  }, [])

  // Initialize order when thumbnails load
  if (thumbnails.length > 0 && order.length !== thumbnails.length) {
    setOrder(thumbnails.map((_, i) => i))
  }

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx === null || dragIdx === targetIdx) return
      setOrder((prev) => {
        const next = [...prev]
        const [item] = next.splice(dragIdx, 1)
        next.splice(targetIdx, 0, item)
        return next
      })
      setDragIdx(null)
    },
    [dragIdx],
  )

  const handleReorder = async () => {
    if (!file || order.length === 0) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await reorderPages(buffer, order)
      downloadBlob(result, `reordered-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder pages')
    }
    setProcessing(false)
  }

  return (
    <ToolLayout
      title="Reorder Pages"
      description="Drag and drop pages to rearrange them in a new order."
    >
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF file here" />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-sm font-medium">{file.name}</span>
              <span className="text-slate-500 text-xs">{thumbnails.length} pages</span>
            </div>
            <button
              onClick={() => { setFile(null); setOrder([]) }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Change file
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">Loading pages...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {order.map((pageIdx, visualIdx) => (
                <div
                  key={`${pageIdx}-${visualIdx}`}
                  draggable
                  onDragStart={() => handleDragStart(visualIdx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(visualIdx)}
                  className={`relative rounded-lg overflow-hidden border-2 border-slate-700 hover:border-blue-500/50 cursor-grab active:cursor-grabbing transition-all ${
                    dragIdx === visualIdx ? 'opacity-40' : ''
                  }`}
                >
                  <img
                    src={thumbnails[pageIdx]}
                    alt={`Page ${pageIdx + 1}`}
                    className="w-full pointer-events-none"
                  />
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
              {processing ? 'Processing...' : 'Save new order'}
            </button>
            <button
              onClick={() => setOrder(thumbnails.map((_, i) => i))}
              className="px-4 py-3 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Reset order
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
