import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { usePdfPages } from '../hooks/usePdfPages'
import { rotatePages } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

export default function RotatePDF() {
  const [file, setFile] = useState<File | null>(null)
  const [rotations, setRotations] = useState<Record<number, number>>({})
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading } = usePdfPages(file)

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setRotations({})
      setError(null)
    }
  }, [])

  const rotate = useCallback((index: number, deg: number) => {
    setRotations((prev) => ({
      ...prev,
      [index]: ((prev[index] ?? 0) + deg) % 360,
    }))
  }, [])

  const rotateAll = useCallback(
    (deg: number) => {
      setRotations((prev) => {
        const next: Record<number, number> = {}
        for (let i = 0; i < thumbnails.length; i++) {
          next[i] = ((prev[i] ?? 0) + deg) % 360
        }
        return next
      })
    },
    [thumbnails.length],
  )

  const handleSave = async () => {
    if (!file) return
    const toApply = Object.fromEntries(
      Object.entries(rotations).filter(([, v]) => v !== 0),
    )
    if (Object.keys(toApply).length === 0) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await rotatePages(buffer, toApply)
      downloadBlob(result, `rotated-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rotate pages')
    }
    setProcessing(false)
  }

  const hasChanges = Object.values(rotations).some((v) => v !== 0)

  return (
    <ToolLayout
      title="Rotate Pages"
      description="Click to rotate individual pages, or rotate all pages at once."
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => rotateAll(90)}
                className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
              >
                Rotate all →
              </button>
              <span className="text-slate-600">·</span>
              <button
                onClick={() => rotateAll(-90)}
                className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
              >
                ← Rotate all
              </button>
              <span className="text-slate-600">·</span>
              <button
                onClick={() => { setFile(null); setRotations({}) }}
                className="text-slate-400 hover:text-white text-xs transition-colors"
              >
                Change file
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">Loading pages...</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {thumbnails.map((thumb, i) => (
                <div
                  key={i}
                  className="relative rounded-lg overflow-hidden border-2 border-slate-700 hover:border-slate-500 transition-all"
                >
                  <img
                    src={thumb}
                    alt={`Page ${i + 1}`}
                    className="w-full transition-transform duration-200"
                    style={{ transform: `rotate(${rotations[i] ?? 0}deg)` }}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1 py-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white text-xs font-medium">{i + 1}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => rotate(i, -90)}
                          className="text-slate-300 hover:text-white text-xs px-1 transition-colors"
                          title="Rotate left"
                        >
                          ↺
                        </button>
                        <button
                          onClick={() => rotate(i, 90)}
                          className="text-slate-300 hover:text-white text-xs px-1 transition-colors"
                          title="Rotate right"
                        >
                          ↻
                        </button>
                      </div>
                    </div>
                  </div>
                  {(rotations[i] ?? 0) !== 0 && (
                    <div className="absolute top-1 right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                      {rotations[i]}°
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={!hasChanges || processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing ? 'Processing...' : 'Download rotated PDF'}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
