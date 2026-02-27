import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { readMetadata, updateMetadata } from '../lib/pdf-operations'
import type { PdfMetadata } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'

export default function EditMetadata() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<PdfMetadata>({})
  const [processing, setProcessing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMetadata = useCallback(async (pdf: File) => {
    setLoading(true)
    try {
      const buf = await pdf.arrayBuffer()
      const meta = await readMetadata(buf)
      setMetadata(meta)
    } catch {
      setMetadata({})
    } finally {
      setLoading(false)
    }
  }, [])

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setError(null)
      loadMetadata(pdf)
    }
  }, [loadMetadata])

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
      setError(e instanceof Error ? e.message : t('metadata.error'))
    }
    setProcessing(false)
  }

  const fields: { key: keyof PdfMetadata; labelKey: TranslationKey; phKey: TranslationKey }[] = [
    { key: 'title', labelKey: 'metadata.field.title', phKey: 'metadata.ph.title' },
    { key: 'author', labelKey: 'metadata.field.author', phKey: 'metadata.ph.author' },
    { key: 'subject', labelKey: 'metadata.field.subject', phKey: 'metadata.ph.subject' },
    { key: 'keywords', labelKey: 'metadata.field.keywords', phKey: 'metadata.ph.keywords' },
    { key: 'creator', labelKey: 'metadata.field.creator', phKey: 'metadata.ph.creator' },
  ]

  return (
    <ToolLayout title={t('metadata.title')} description={t('metadata.description')}>
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label={t('common.drop')} />
      ) : loading ? (
        <div className="text-center py-16 text-slate-500">{t('metadata.reading')}</div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-300 text-sm font-medium">{file.name}</span>
            <button
              onClick={() => { setFile(null); setMetadata({}) }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  {t(f.labelKey)}
                </label>
                <input
                  type="text"
                  value={
                    f.key === 'keywords'
                      ? (metadata.keywords ?? []).join(', ')
                      : (metadata[f.key] as string) ?? ''
                  }
                  onChange={(e) => handleField(f.key, e.target.value)}
                  placeholder={t(f.phKey)}
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
              {processing ? t('metadata.saving') : t('metadata.button')}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
