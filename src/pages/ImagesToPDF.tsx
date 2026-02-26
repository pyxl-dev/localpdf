import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { imagesToPDF } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

export default function ImagesToPDF() {
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const handleFiles = useCallback((newFiles: File[]) => {
    const images = newFiles.filter((f) => f.type.startsWith('image/'))
    setFiles((prev) => [...prev, ...images])
    const newPreviews = images.map((f) => URL.createObjectURL(f))
    setPreviews((prev) => [...prev, ...newPreviews])
    setError(null)
  }, [])

  const handleRemove = useCallback((index: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragStart = useCallback((idx: number) => {
    setDragIdx(idx)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx === null || dragIdx === targetIdx) return
      setFiles((prev) => {
        const next = [...prev]
        const [item] = next.splice(dragIdx, 1)
        next.splice(targetIdx, 0, item)
        return next
      })
      setPreviews((prev) => {
        const next = [...prev]
        const [item] = next.splice(dragIdx, 1)
        next.splice(targetIdx, 0, item)
        return next
      })
      setDragIdx(null)
    },
    [dragIdx],
  )

  const handleConvert = async () => {
    if (files.length === 0) return
    setProcessing(true)
    setError(null)
    try {
      const images = await Promise.all(
        files.map(async (f) => ({
          data: await f.arrayBuffer(),
          type: f.type,
        })),
      )
      const result = await imagesToPDF(images)
      downloadBlob(result, 'images.pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create PDF')
    }
    setProcessing(false)
  }

  return (
    <ToolLayout
      title="Images to PDF"
      description="Convert JPG, PNG images into a multi-page PDF document."
    >
      <FileDropzone
        accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
        multiple
        onFiles={handleFiles}
        label="Drop your images here"
        hint="JPG, PNG — drag to reorder after adding"
      />

      {files.length > 0 && (
        <div className="mt-6 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {previews.map((preview, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(i)}
              className={`relative rounded-lg overflow-hidden border-2 border-slate-700 hover:border-slate-500 cursor-grab active:cursor-grabbing transition-all aspect-[3/4] ${
                dragIdx === i ? 'opacity-40' : ''
              }`}
            >
              <img
                src={preview}
                alt={files[i].name}
                className="w-full h-full object-cover pointer-events-none"
              />
              <button
                onClick={() => handleRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-500 transition-colors"
              >
                ×
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                <span className="text-white text-xs font-medium">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={handleConvert}
          disabled={files.length === 0 || processing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          {processing ? 'Converting...' : `Create PDF (${files.length} image${files.length !== 1 ? 's' : ''})`}
        </button>
        {files.length > 0 && (
          <button
            onClick={() => {
              previews.forEach((p) => URL.revokeObjectURL(p))
              setFiles([])
              setPreviews([])
            }}
            className="px-4 py-3 text-slate-400 hover:text-white transition-colors text-sm"
          >
            Clear all
          </button>
        )}
      </div>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </ToolLayout>
  )
}
