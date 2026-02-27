import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { usePdfPages } from '../hooks/usePdfPages'
import { extractPages } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'

export default function SplitPDF() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { thumbnails, loading, loadFile, reset } = usePdfPages()

  const handleFiles = useCallback((files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (pdf) {
      setFile(pdf)
      setSelected(new Set())
      setError(null)
      loadFile(pdf)
    }
  }, [loadFile])

  const togglePage = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelected(new Set(thumbnails.map((_, i) => i)))
  }, [thumbnails])

  const selectNone = useCallback(() => {
    setSelected(new Set())
  }, [])

  const handleExtract = async () => {
    if (!file || selected.size === 0) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const indices = Array.from(selected).sort((a, b) => a - b)
      const result = await extractPages(buffer, indices)
      downloadBlob(result, `split-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('split.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('split.title')} description={t('split.description')}>
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
              onClick={() => { setFile(null); setSelected(new Set()); reset() }}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-slate-500">{t('common.loading')}</div>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button onClick={selectAll} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  {t('split.selectAll')}
                </button>
                <span className="text-slate-600">·</span>
                <button onClick={selectNone} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  {t('split.selectNone')}
                </button>
                <span className="text-slate-500 text-xs ml-auto">{t('split.selected', { count: selected.size })}</span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {thumbnails.map((thumb, i) => (
                  <button
                    key={i}
                    onClick={() => togglePage(i)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                      selected.has(i)
                        ? 'border-blue-500 ring-2 ring-blue-500/30'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <img src={thumb} alt={`Page ${i + 1}`} className="w-full" />
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
                      <span className="text-white text-xs font-medium">{i + 1}</span>
                    </div>
                    {selected.has(i) && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="mt-6">
            <button
              onClick={handleExtract}
              disabled={selected.size === 0 || processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing
                ? t('split.extracting')
                : t('split.button', { count: selected.size, s: selected.size !== 1 ? 's' : '' })}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
