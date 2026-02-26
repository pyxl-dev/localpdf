import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { mergePDFs } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

export default function MergePDF() {
  const [files, setFiles] = useState<File[]>([])
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const handleFiles = useCallback((newFiles: File[]) => {
    const pdfs = newFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    )
    setFiles((prev) => [...prev, ...pdfs])
    setError(null)
  }, [])

  const handleRemove = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleDragStart = useCallback((index: number) => {
    setDragIdx(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIdx === null || dragIdx === targetIndex) return
      setFiles((prev) => {
        const next = [...prev]
        const [item] = next.splice(dragIdx, 1)
        next.splice(targetIndex, 0, item)
        return next
      })
      setDragIdx(null)
    },
    [dragIdx],
  )

  const handleMerge = async () => {
    if (files.length < 2) return
    setProcessing(true)
    setError(null)
    try {
      const buffers = await Promise.all(files.map((f) => f.arrayBuffer()))
      const merged = await mergePDFs(buffers)
      downloadBlob(merged, 'merged.pdf')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to merge PDFs')
    }
    setProcessing(false)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single document. Drag to reorder."
    >
      <FileDropzone
        accept=".pdf"
        multiple
        onFiles={handleFiles}
        label="Drop your PDF files here"
        hint="or click to browse — you can add multiple files"
      />

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${file.size}-${i}`}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(i)}
              className={`flex items-center gap-3 bg-slate-900/50 border border-slate-800/60 rounded-lg px-4 py-3 cursor-grab active:cursor-grabbing transition-opacity ${
                dragIdx === i ? 'opacity-40' : ''
              }`}
            >
              <span className="text-slate-600 select-none">☰</span>
              <span className="text-slate-200 text-sm truncate flex-1">{file.name}</span>
              <span className="text-slate-500 text-xs shrink-0">{formatSize(file.size)}</span>
              <button
                onClick={() => handleRemove(i)}
                className="text-red-400/70 hover:text-red-400 text-lg leading-none transition-colors"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={handleMerge}
          disabled={files.length < 2 || processing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          {processing ? 'Merging...' : `Merge ${files.length} file${files.length !== 1 ? 's' : ''}`}
        </button>

        {files.length > 0 && (
          <button
            onClick={() => setFiles([])}
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
