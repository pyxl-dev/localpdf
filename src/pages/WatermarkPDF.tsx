import { useState, useCallback } from 'react'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { addWatermark } from '../lib/pdf-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'

export default function WatermarkPDF() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(60)
  const [opacity, setOpacity] = useState(15)
  const [rotation, setRotation] = useState(45)
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
    if (!file || !text.trim()) return
    setProcessing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await addWatermark(buffer, {
        text: text.trim(),
        fontSize,
        opacity: opacity / 100,
        rotation,
      })
      downloadBlob(result, `watermarked-${file.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('watermark.error'))
    }
    setProcessing(false)
  }

  return (
    <ToolLayout title={t('watermark.title')} description={t('watermark.description')}>
      {!file ? (
        <FileDropzone accept=".pdf" onFiles={handleFiles} label={t('common.drop')} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <span className="text-slate-300 text-sm font-medium">{file.name}</span>
            <button
              onClick={() => setFile(null)}
              className="text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('common.changeFile')}
            </button>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">
                {t('watermark.text')}
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('watermark.textPh')}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  {t('watermark.fontSize')}
                </label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  min={12}
                  max={200}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  {t('watermark.opacity')} (%)
                </label>
                <input
                  type="number"
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">
                  {t('watermark.rotation')} (°)
                </label>
                <input
                  type="number"
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  min={-180}
                  max={180}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-6 flex items-center justify-center h-32">
              <span
                className="text-slate-500 font-bold select-none"
                style={{
                  fontSize: `${Math.min(fontSize, 40)}px`,
                  opacity: opacity / 100,
                  transform: `rotate(${rotation}deg)`,
                }}
              >
                {text || t('watermark.preview')}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleProcess}
              disabled={!text.trim() || processing}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
            >
              {processing ? t('watermark.processing') : t('watermark.button')}
            </button>
          </div>

          {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
        </>
      )}
    </ToolLayout>
  )
}
