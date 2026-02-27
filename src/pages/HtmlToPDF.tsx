import { useState, useCallback } from 'react'
import html2pdf from 'html2pdf.js'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { useTranslation } from '../i18n/useTranslation'

export default function HtmlToPDF() {
  const { t } = useTranslation()
  const [html, setHtml] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setHtml(text)
        setError(null)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleConvert = async () => {
    if (!html.trim()) return
    setProcessing(true)
    setError(null)
    try {
      const container = document.createElement('div')
      container.innerHTML = html
      container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; padding: 20px; max-width: 800px;'

      document.body.appendChild(container)

      await html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename: 'converted.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .save()

      document.body.removeChild(container)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('html.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('html.title')} description={t('html.description')}>
      <FileDropzone
        accept=".html,.htm"
        onFiles={handleFiles}
        label={t('html.drop')}
        hint={t('html.hint')}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              {t('html.editor')}
            </label>
            {html && (
              <button
                onClick={() => setHtml('')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t('html.clear')}
              </button>
            )}
          </div>
          <textarea
            value={html}
            onChange={(e) => {
              setHtml(e.target.value)
              setError(null)
            }}
            placeholder={t('html.placeholder')}
            className="w-full h-96 bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono resize-none focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            {t('html.preview')}
          </label>
          <iframe
            sandbox="allow-same-origin"
            srcDoc={html || '<p style="color:#94a3b8;font-family:sans-serif;padding:16px;">Preview will appear here...</p>'}
            className="w-full h-96 bg-white rounded-lg border border-slate-700"
            title="HTML Preview"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleConvert}
          disabled={!html.trim() || processing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          {processing ? t('html.converting') : t('html.button')}
        </button>
      </div>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </ToolLayout>
  )
}
