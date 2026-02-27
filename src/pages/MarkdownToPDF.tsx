import { useState, useCallback, useRef, useMemo } from 'react'
import { marked } from 'marked'
import html2pdf from 'html2pdf.js'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { useTranslation } from '../i18n/useTranslation'

const markdownStyles = `
  .markdown-preview h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  .markdown-preview h2 { font-size: 1.5em; font-weight: 600; margin: 0.83em 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.3em; }
  .markdown-preview h3 { font-size: 1.25em; font-weight: 600; margin: 1em 0; }
  .markdown-preview h4 { font-size: 1em; font-weight: 600; margin: 1em 0; }
  .markdown-preview p { margin: 1em 0; line-height: 1.7; }
  .markdown-preview ul, .markdown-preview ol { margin: 1em 0; padding-left: 2em; }
  .markdown-preview li { margin: 0.25em 0; }
  .markdown-preview code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 3px; font-size: 0.9em; font-family: 'SFMono-Regular', Consolas, monospace; }
  .markdown-preview pre { background: #f3f4f6; padding: 1em; border-radius: 6px; overflow-x: auto; margin: 1em 0; }
  .markdown-preview pre code { background: none; padding: 0; }
  .markdown-preview blockquote { border-left: 4px solid #d1d5db; padding-left: 1em; margin: 1em 0; color: #6b7280; }
  .markdown-preview a { color: #2563eb; text-decoration: underline; }
  .markdown-preview table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  .markdown-preview th, .markdown-preview td { border: 1px solid #d1d5db; padding: 0.5em 0.75em; text-align: left; }
  .markdown-preview th { background: #f9fafb; font-weight: 600; }
  .markdown-preview hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  .markdown-preview img { max-width: 100%; }
`

export default function MarkdownToPDF() {
  const { t } = useTranslation()
  const [markdown, setMarkdown] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const handleFiles = useCallback((files: File[]) => {
    const file = files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        setMarkdown(text)
        setError(null)
      }
    }
    reader.readAsText(file)
  }, [])

  const htmlContent = useMemo(() => {
    if (!markdown) return ''
    return marked.parse(markdown, { async: false }) as string
  }, [markdown])

  const handleConvert = async () => {
    if (!markdown.trim()) return
    setProcessing(true)
    setError(null)
    try {
      const container = document.createElement('div')
      container.innerHTML = htmlContent
      container.className = 'markdown-preview'
      container.style.cssText = 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937; padding: 20px; max-width: 800px;'

      const style = document.createElement('style')
      style.textContent = markdownStyles
      container.prepend(style)

      document.body.appendChild(container)

      await html2pdf()
        .set({
          margin: [15, 15, 15, 15],
          filename: 'markdown.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(container)
        .save()

      document.body.removeChild(container)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('markdown.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('markdown.title')} description={t('markdown.description')}>
      <FileDropzone
        accept=".md,.txt,.markdown"
        onFiles={handleFiles}
        label={t('markdown.drop')}
        hint={t('markdown.hint')}
      />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-300">
              {t('markdown.editor')}
            </label>
            {markdown && (
              <button
                onClick={() => setMarkdown('')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t('markdown.clear')}
              </button>
            )}
          </div>
          <textarea
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value)
              setError(null)
            }}
            placeholder={t('markdown.placeholder')}
            className="w-full h-96 bg-slate-900/50 border border-slate-700 rounded-lg p-4 text-slate-200 text-sm font-mono resize-none focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-300 mb-2 block">
            {t('markdown.preview')}
          </label>
          <div
            ref={previewRef}
            className="w-full h-96 bg-white rounded-lg p-4 overflow-auto text-sm"
          >
            <style>{markdownStyles}</style>
            <div
              className="markdown-preview"
              style={{ color: '#1f2937', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleConvert}
          disabled={!markdown.trim() || processing}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          {processing ? t('markdown.converting') : t('markdown.button')}
        </button>
      </div>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </ToolLayout>
  )
}
