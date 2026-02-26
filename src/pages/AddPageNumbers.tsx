import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { addPageNumbers } from '../lib/pdf-operations'
import type { PageNumberOptions } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

type Position = PageNumberOptions['position']

const positions: { value: Position; label: string }[] = [
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
]

export default function AddPageNumbers() {
  const [file, setFile] = useState<File | null>(null)
  const [position, setPosition] = useState<Position>('bottom-center')
  const [fontSize, setFontSize] = useState(12)
  const [startFrom, setStartFrom] = useState(1)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setError(null)
    }
  }, [])

  const handleProcess = async () => {
    if (!file) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await addPageNumbers(buffer, { position, fontSize, startFrom })
      downloadBlob(result, `numbered-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add page numbers')
    }
    setProcessing(false)
  }

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Add page numbers to every page of your PDF document."
    >
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF file here" />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-300 text-sm font-medium">{file.name}</span>
            <button
              onClick={() => setFile(null)}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Change file
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as Position)}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                {positions.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Font size</label>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={6}
                max={72}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Start from</label>
              <input
                type="number"
                value={startFrom}
                onChange={(e) => setStartFrom(Number(e.target.value))}
                min={0}
                className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing ? 'Adding numbers...' : 'Add numbers & download'}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
