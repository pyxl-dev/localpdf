import { useState, useCallback, useEffect } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { readMetadata, updateMetadata } from '../lib/pdf-operations'
import type { PdfMetadata } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'

export default function EditMetadata() {
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<PdfMetadata>({})
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setError(null)
    }
  }, [])

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setLoading(true)
    file
      .arrayBuffer()
      .then((buf) => readMetadata(buf))
      .then((meta) => {
        if (!cancelled) {
          setMetadata(meta)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [file])

  const handleField = (field: keyof PdfMetadata, value: string) => {
    setMetadata((prev) => ({
      ...prev,
      [field]: field === 'keywords' ? value.split(',').map((k) => k.trim()) : value,
    }))
  }

  const handleSave = async () => {
    if (!file) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await updateMetadata(buffer, metadata)
      downloadBlob(result, file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update metadata')
    }
    setProcessing(false)
  }

  const fields: { key: keyof PdfMetadata; label: string; placeholder: string }[] = [
    { key: 'title', label: 'Title', placeholder: 'Document title' },
    { key: 'author', label: 'Author', placeholder: 'Author name' },
    { key: 'subject', label: 'Subject', placeholder: 'Document subject' },
    { key: 'keywords', label: 'Keywords', placeholder: 'keyword1, keyword2, keyword3' },
    { key: 'creator', label: 'Creator', placeholder: 'Application that created the document' },
  ]

  return (
    <ToolLayout
      title="Edit Metadata"
      description="View and edit your PDF document properties — title, author, subject, keywords."
    >
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF file here" />
      ) : loading ? (
        <div className="text-center py-16 text-slate-500">Reading metadata...</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-300 text-sm font-medium">{file.name}</span>
            <button
              onClick={() => { setFile(null); setMetadata({}) }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              Change file
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  {f.label}
                </label>
                <input
                  type="text"
                  value={
                    f.key === 'keywords'
                      ? (metadata.keywords ?? []).join(', ')
                      : (metadata[f.key] as string) ?? ''
                  }
                  onChange={(e) => handleField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                />
              </div>
            ))}
          </div>

          <div className="mt-6">
            <button
              onClick={handleSave}
              disabled={processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing ? 'Saving...' : 'Save metadata & download'}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
