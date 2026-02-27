import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { usePdfPages } from '../hooks/usePdfPages'
import { removePages } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'

export default function RemovePages() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [toRemove, setToRemove] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading, loadFile, reset } = usePdfPages()

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setToRemove(new Set())
      setError(null)
      loadFile(pdf)
    }
  }, [loadFile])

  const togglePage = useCallback((index: number) => {
    setToRemove((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const handleRemove = async () => {
    if (!file || toRemove.size === 0) return
    if (toRemove.size >= thumbnails.length) {
      setError(t('remove.allError'))
      return
    }
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const indices = Array.from(toRemove)
      const result = await removePages(buffer, indices)
      downloadBlob(result, `trimmed-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('remove.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('remove.title')} description={t('remove.description')}>
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
              onClick={() => { setFile(null); setToRemove(new Set()); reset() }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">{t('common.loading')}</div>
          ) : (
            <>
              <p className="text-slate-500 text-sm mb-4">{t('remove.hint')}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {thumbnails.map((thumb, i) => (
                  <button
                    key={i}
                    onClick={() => togglePage(i)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      toRemove.has(i)
                        ? 'border-red-500 ring-2 ring-red-500/30'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <img src={thumb} alt={`Page ${i + 1}`} className="w-full" />
                    {toRemove.has(i) && (
                      <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                      <span className="text-white text-xs font-medium">{i + 1}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={handleRemove}
              disabled={toRemove.size === 0 || processing}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing
                ? t('remove.removing')
                : t('remove.button', { count: toRemove.size, s: toRemove.size !== 1 ? 's' : '' })}
            </button>
            {toRemove.size > 0 && (
              <span className="text-slate-500 text-sm">
                {t('remove.remaining', { count: thumbnails.length - toRemove.size })}
              </span>
            )}
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
