import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import ToolLayout from '../components/ToolLayout'
import FileDropzone from '../components/FileDropzone'
import { extractFormFields, fillFormFields } from '../lib/pdf-form-operations'
import type { FormFieldInfo, FormFieldValue, FreeSignature } from '../lib/pdf-form-operations'
import { downloadBlob } from '../lib/download'
import { useTranslation } from '../i18n/useTranslation'
import { Link } from 'react-router-dom'

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5]

function trimCanvas(canvas: HTMLCanvasElement): string | undefined {
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  let top = height, bottom = 0, left = width, right = 0

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const isWhite = data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255
      if (!isWhite && data[i + 3] > 0) {
        if (y < top) top = y
        if (y > bottom) bottom = y
        if (x < left) left = x
        if (x > right) right = x
      }
    }
  }

  if (top > bottom) return undefined

  const pad = 4
  top = Math.max(0, top - pad)
  left = Math.max(0, left - pad)
  bottom = Math.min(height - 1, bottom + pad)
  right = Math.min(width - 1, right + pad)

  const trimmed = document.createElement('canvas')
  trimmed.width = right - left + 1
  trimmed.height = bottom - top + 1
  trimmed.getContext('2d')!.drawImage(
    canvas, left, top, trimmed.width, trimmed.height,
    0, 0, trimmed.width, trimmed.height,
  )
  return trimmed.toDataURL('image/png')
}

function pdfRectToCSS(
  rect: FormFieldInfo['rect'],
  pageHeight: number,
  scale: number,
): React.CSSProperties {
  return {
    position: 'absolute',
    left: rect.x * scale,
    top: (pageHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}

function SignaturePad({
  style,
  value,
  onChange,
  t,
}: {
  style: React.CSSProperties
  value: FormFieldValue
  onChange: (val: FormFieldValue) => void
  t: (key: string) => string
}) {
  const padRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasSig = !!value.signatureDataUrl

  const getPos = (e: React.PointerEvent) => {
    const canvas = padRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = padRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawing.current = true
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !padRef.current) return
    const ctx = padRef.current.getContext('2d')!
    const pos = getPos(e)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e293b'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const handlePointerUp = () => {
    if (!isDrawing.current || !padRef.current) return
    isDrawing.current = false
    const dataUrl = trimCanvas(padRef.current)
    if (dataUrl) {
      onChange({ ...value, signatureDataUrl: dataUrl })
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    const canvas = padRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange({ ...value, signatureDataUrl: undefined })
  }

  // Size canvas to match container
  useEffect(() => {
    const canvas = padRef.current
    if (!canvas) return
    const w = parseInt(String(style.width)) || 200
    const h = parseInt(String(style.height)) || 40
    canvas.width = w
    canvas.height = h

    // Redraw existing signature if present
    if (value.signatureDataUrl) {
      const img = new Image()
      img.onload = () => {
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      }
      img.src = value.signatureDataUrl
    }
  }, [style.width, style.height])

  return (
    <div
      style={style}
      className="border-2 border-dashed border-purple-400/60 hover:border-purple-400 bg-white/80 rounded-sm relative group"
      title={t('fillforms.signatureHint')}
    >
      <canvas
        ref={padRef}
        className="w-full h-full cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      {hasSig && (
        <button
          onClick={handleClear}
          className="absolute top-0.5 right-0.5 p-0.5 bg-red-500/80 hover:bg-red-500 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title={t('fillforms.signatureClear')}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {!hasSig && (
        <span className="absolute inset-0 flex items-center justify-center text-purple-400/60 text-xs pointer-events-none select-none">
          {t('fillforms.signatureHint')}
        </span>
      )}
    </div>
  )
}

function SignatureModal({
  onConfirm,
  onCancel,
  t,
}: {
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
  t: (key: string) => string
}) {
  const padRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const hasStrokes = useRef(false)

  useEffect(() => {
    const canvas = padRef.current
    if (!canvas) return
    canvas.width = 400
    canvas.height = 150
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 150)
  }, [])

  const getPos = (e: React.PointerEvent) => {
    const canvas = padRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    const canvas = padRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    isDrawing.current = true
    hasStrokes.current = true
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing.current || !padRef.current) return
    const ctx = padRef.current.getContext('2d')!
    const pos = getPos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e293b'
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const handlePointerUp = () => {
    isDrawing.current = false
  }

  const handleClear = () => {
    const canvas = padRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasStrokes.current = false
  }

  const handleConfirm = () => {
    if (!padRef.current || !hasStrokes.current) return
    const dataUrl = trimCanvas(padRef.current)
    if (dataUrl) onConfirm(dataUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-lg w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-semibold mb-4">{t('fillforms.signatureHint')}</h3>
        <div className="border border-slate-600 rounded-lg overflow-hidden mb-4">
          <canvas
            ref={padRef}
            className="w-full cursor-crosshair touch-none"
            style={{ height: 150 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            {t('fillforms.signatureClear')}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              {t('fillforms.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-colors"
            >
              {t('fillforms.signaturePlace')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DraggableSignature({
  sig,
  zoom,
  pageHeight,
  onMove,
  onRemove,
  onResize,
  t,
}: {
  sig: FreeSignature
  zoom: number
  pageHeight: number
  onMove: (id: string, newX: number, newY: number) => void
  onRemove: (id: string) => void
  onResize: (id: string, newWidth: number, newHeight: number) => void
  t: (key: string) => string
}) {
  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const startPos = useRef({ x: 0, y: 0 })
  const startSigPos = useRef({ x: 0, y: 0 })
  const startSize = useRef({ width: 0, height: 0 })
  const divRef = useRef<HTMLDivElement>(null)

  const aspectRatio = sig.width / sig.height

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    if ((e.target as HTMLElement).dataset.resizeHandle) return
    e.preventDefault()
    e.stopPropagation()
    isDragging.current = true
    startPos.current = { x: e.clientX, y: e.clientY }
    startSigPos.current = { x: sig.x, y: sig.y }
    divRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    e.stopPropagation()
    const deltaX = (e.clientX - startPos.current.x) / zoom
    const deltaY = -(e.clientY - startPos.current.y) / zoom
    const newX = startSigPos.current.x + deltaX
    const newY = startSigPos.current.y + deltaY
    const div = divRef.current
    if (div) {
      div.style.left = `${newX * zoom}px`
      div.style.top = `${(pageHeight - newY - sig.height) * zoom}px`
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    divRef.current?.releasePointerCapture(e.pointerId)
    const deltaX = (e.clientX - startPos.current.x) / zoom
    const deltaY = -(e.clientY - startPos.current.y) / zoom
    const newX = startSigPos.current.x + deltaX
    const newY = startSigPos.current.y + deltaY
    onMove(sig.id, newX, newY)
  }

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    isResizing.current = true
    startPos.current = { x: e.clientX, y: e.clientY }
    startSize.current = { width: sig.width, height: sig.height }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (!isResizing.current) return
    e.preventDefault()
    e.stopPropagation()
    const deltaX = (e.clientX - startPos.current.x) / zoom
    const newWidth = Math.max(40, startSize.current.width + deltaX)
    const newHeight = Math.max(20, newWidth / aspectRatio)
    const div = divRef.current
    if (div) {
      div.style.width = `${newWidth * zoom}px`
      div.style.height = `${newHeight * zoom}px`
      div.style.top = `${(pageHeight - sig.y - newHeight) * zoom}px`
    }
  }

  const handleResizePointerUp = (e: React.PointerEvent) => {
    if (!isResizing.current) return
    isResizing.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    const deltaX = (e.clientX - startPos.current.x) / zoom
    const newWidth = Math.max(40, startSize.current.width + deltaX)
    const newHeight = Math.max(20, newWidth / aspectRatio)
    onResize(sig.id, newWidth, newHeight)
  }

  return (
    <div
      ref={divRef}
      className="absolute group"
      style={{
        left: sig.x * zoom,
        top: (pageHeight - sig.y - sig.height) * zoom,
        width: sig.width * zoom,
        height: sig.height * zoom,
        cursor: 'grab',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <img
        src={sig.dataUrl}
        alt="Signature"
        className="w-full h-full object-contain pointer-events-none"
        draggable={false}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(sig.id) }}
        className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-400 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        title={t('fillforms.signatureClear')}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Resize handle */}
      <div
        data-resize-handle="true"
        className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500/80 hover:bg-blue-400 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        style={{ cursor: 'nwse-resize', touchAction: 'none' }}
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
      >
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M10 2L2 10M10 6L6 10" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

function FormFieldInput({
  field,
  value,
  pageHeight,
  scale,
  onChange,
  t,
}: {
  field: FormFieldInfo
  value: FormFieldValue
  pageHeight: number
  scale: number
  onChange: (val: FormFieldValue) => void
  t: (key: string) => string
}) {
  const style = pdfRectToCSS(field.rect, pageHeight, scale)
  const fontSize = Math.max(10, field.rect.height * 0.65 * scale)

  const baseClasses =
    'border border-dashed border-blue-400/50 hover:border-blue-400 focus-within:border-blue-500 focus-within:border-solid focus-within:bg-white/90 transition-all bg-blue-50/20 rounded-sm'

  if (field.type === 'signature') {
    return (
      <SignaturePad
        style={style}
        value={value}
        onChange={onChange}
        t={t}
      />
    )
  }

  if (field.readOnly) {
    return (
      <div
        style={{ ...style, fontSize }}
        className="border border-dashed border-slate-500/30 bg-slate-700/20 rounded-sm flex items-center px-1 text-slate-400 cursor-not-allowed overflow-hidden"
      >
        {field.value || field.name}
      </div>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <div style={style} className={`${baseClasses} flex items-center justify-center`}>
        <input
          type="checkbox"
          checked={value.checked ?? false}
          onChange={(e) => onChange({ ...value, checked: e.target.checked })}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
        />
      </div>
    )
  }

  if (field.type === 'dropdown') {
    return (
      <select
        style={{ ...style, fontSize: Math.max(10, fontSize * 0.85) }}
        className={`${baseClasses} px-1 text-slate-900 focus:outline-none cursor-pointer`}
        value={value.selected?.[0] ?? ''}
        onChange={(e) => onChange({ ...value, selected: [e.target.value] })}
      >
        <option value="">&mdash;</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'radio') {
    return (
      <div style={style} className={`${baseClasses} flex items-center justify-center`}>
        <input
          type="radio"
          name={field.name}
          checked={(value.selected?.[0] ?? '') === field.value}
          onChange={() => onChange({ ...value, selected: [field.value] })}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
        />
      </div>
    )
  }

  // Default: text input
  const isMultiline = field.rect.height > 30
  if (isMultiline) {
    return (
      <textarea
        style={{ ...style, fontSize, resize: 'none' }}
        className={`${baseClasses} px-1 text-slate-900 focus:outline-none`}
        value={value.textValue ?? ''}
        onChange={(e) => onChange({ ...value, textValue: e.target.value })}
      />
    )
  }

  return (
    <input
      type="text"
      style={{ ...style, fontSize }}
      className={`${baseClasses} px-1 text-slate-900 focus:outline-none`}
      value={value.textValue ?? ''}
      onChange={(e) => onChange({ ...value, textValue: e.target.value })}
    />
  )
}

export default function FillPDF() {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null)
  const [fields, setFields] = useState<FormFieldInfo[]>([])
  const [values, setValues] = useState<Record<string, FormFieldValue>>({})
  const [currentPage, setCurrentPage] = useState(0)
  const [pageCount, setPageCount] = useState(0)
  const [pageHeight, setPageHeight] = useState(0)
  const [zoom, setZoom] = useState(1.0)
  const [flatten, setFlatten] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [freeSignatures, setFreeSignatures] = useState<FreeSignature[]>([])
  const [showSigModal, setShowSigModal] = useState(false)
  const [placingSigDataUrl, setPlacingSigDataUrl] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  const handleFiles = useCallback(async (files: File[]) => {
    const pdf = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    if (!pdf) return

    setFile(pdf)
    setError(null)
    setLoading(true)

    try {
      const buf = await pdf.arrayBuffer()
      // Copy the buffer so it survives being detached by pdfjs/pdf-lib
      setBuffer(buf.slice(0))

      const extractedFields = await extractFormFields(buf.slice(0))
      setFields(extractedFields)

      // Initialize values from extracted fields
      const initialValues: Record<string, FormFieldValue> = {}
      for (const field of extractedFields) {
        const key = `${field.name}__${field.pageIndex}__${field.rect.x}`
        if (!initialValues[key]) {
          initialValues[key] = {
            name: field.name,
            type: field.type,
            textValue: field.value,
            checked: field.isChecked,
            selected: field.selected,
            pageIndex: field.pageIndex,
            rect: field.rect,
          }
        }
      }
      setValues(initialValues)

      // Load pdfjs document for rendering
      const uint8 = new Uint8Array(buf)
      const pdfDoc = await pdfjsLib.getDocument({ data: uint8 }).promise
      pdfDocRef.current = pdfDoc
      setPageCount(pdfDoc.numPages)
      setCurrentPage(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fillforms.error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  // Render current page to canvas
  useEffect(() => {
    const pdfDoc = pdfDocRef.current
    if (!pdfDoc || !canvasRef.current) return

    let cancelled = false
    const render = async () => {
      const page = await pdfDoc.getPage(currentPage + 1)
      if (cancelled) return

      const viewport = page.getViewport({ scale: zoom })
      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height

      // Store page height in PDF units for coordinate conversion
      const baseViewport = page.getViewport({ scale: 1 })
      setPageHeight(baseViewport.height)

      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise
    }

    render()
    return () => { cancelled = true }
  }, [currentPage, zoom, pageCount])

  // Cleanup pdfjs doc on unmount
  useEffect(() => {
    return () => {
      pdfDocRef.current?.destroy()
    }
  }, [])

  const currentPageFields = useMemo(
    () => fields.filter((f) => f.pageIndex === currentPage),
    [fields, currentPage],
  )

  const fieldKey = (field: FormFieldInfo) => `${field.name}__${field.pageIndex}__${field.rect.x}`

  const handleFieldChange = useCallback((field: FormFieldInfo, val: FormFieldValue) => {
    const key = fieldKey(field)
    setValues((prev) => ({ ...prev, [key]: val }))
  }, [])

  const handleSigModalConfirm = useCallback((dataUrl: string) => {
    setShowSigModal(false)
    setPlacingSigDataUrl(dataUrl)
  }, [])

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!placingSigDataUrl || !canvasRef.current) return
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Convert screen coords to PDF coords
    const sigWidthPx = 180 * zoom
    const sigHeightPx = 60 * zoom
    const pdfX = (clickX - sigWidthPx / 2) / zoom
    const pdfY = pageHeight - (clickY + sigHeightPx / 2) / zoom

    setFreeSignatures((prev) => [...prev, {
      id: `sig_${Date.now()}`,
      pageIndex: currentPage,
      x: pdfX,
      y: pdfY,
      width: 180,
      height: 60,
      dataUrl: placingSigDataUrl,
    }])
    setPlacingSigDataUrl(null)
  }, [placingSigDataUrl, zoom, pageHeight, currentPage])

  const handleRemoveFreeSig = useCallback((id: string) => {
    setFreeSignatures((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleMoveFreeSig = useCallback((id: string, newX: number, newY: number) => {
    setFreeSignatures((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: newX, y: newY } : s)),
    )
  }, [])

  const handleResizeFreeSig = useCallback((id: string, newWidth: number, newHeight: number) => {
    setFreeSignatures((prev) =>
      prev.map((s) => (s.id === id ? { ...s, width: newWidth, height: newHeight } : s)),
    )
  }, [])

  const handleSave = async () => {
    if (!buffer) return
    setProcessing(true)
    setError(null)

    try {
      const allValues = Object.values(values)
      const result = await fillFormFields(buffer, allValues, flatten, freeSignatures)
      const name = file?.name ?? 'filled.pdf'
      const outputName = name.replace(/\.pdf$/i, '_filled.pdf')
      downloadBlob(result, outputName)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('fillforms.error'))
    } finally {
      setProcessing(false)
    }
  }

  const fillableCount = fields.filter((f) => !f.readOnly && f.type !== 'button').length

  // No file loaded
  if (!file) {
    return (
      <ToolLayout title={t('fillforms.title')} description={t('fillforms.description')}>
        <FileDropzone accept=".pdf" onFiles={handleFiles} label={t('common.drop')} />
      </ToolLayout>
    )
  }

  // Loading
  if (loading) {
    return (
      <ToolLayout title={t('fillforms.title')} description={t('fillforms.description')}>
        <div className="text-center py-16 text-slate-500">{t('common.loading')}</div>
      </ToolLayout>
    )
  }

  // No form fields found
  if (fields.length === 0) {
    return (
      <ToolLayout title={t('fillforms.title')} description={t('fillforms.description')}>
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg mb-4">{t('fillforms.noFields')}</p>
          <Link
            to="/"
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {t('common.allTools')}
          </Link>
        </div>
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title={t('fillforms.title')} description={t('fillforms.description')}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-6 bg-slate-900/50 border border-slate-800/60 rounded-xl p-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-slate-300 text-sm font-medium truncate">{file.name}</span>
          <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">
            {t('fillforms.fieldCount').replace('{count}', String(fillableCount))}
          </span>
        </div>

        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 transition-colors"
            title={t('fillforms.prev')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="text-slate-300 text-sm whitespace-nowrap">
            {t('fillforms.page')
              .replace('{current}', String(currentPage + 1))
              .replace('{total}', String(pageCount))}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage >= pageCount - 1}
            className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 transition-colors"
            title={t('fillforms.next')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => ZOOM_LEVELS[Math.max(0, ZOOM_LEVELS.indexOf(z) - 1)] ?? z)}
            disabled={zoom === ZOOM_LEVELS[0]}
            className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
            </svg>
          </button>
          <span className="text-slate-400 text-xs w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, ZOOM_LEVELS.indexOf(z) + 1)] ?? z)}
            disabled={zoom === ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            className="p-1.5 text-slate-400 hover:text-white disabled:text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Add signature button */}
        <button
          onClick={() => setShowSigModal(true)}
          className="px-3 py-2 bg-purple-600/80 text-white rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
          {t('fillforms.addSignature')}
        </button>

        {/* Flatten toggle */}
        <label className="flex items-center gap-2 cursor-pointer" title={t('fillforms.flattenHint')}>
          <input
            type="checkbox"
            checked={flatten}
            onChange={(e) => setFlatten(e.target.checked)}
            className="w-4 h-4 accent-blue-500"
          />
          <span className="text-slate-400 text-sm">{t('fillforms.flatten')}</span>
        </label>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={processing}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors"
        >
          {processing ? t('fillforms.saving') : t('fillforms.save')}
        </button>

        {/* Change file */}
        <button
          onClick={() => {
            pdfDocRef.current?.destroy()
            pdfDocRef.current = null
            setFile(null)
            setBuffer(null)
            setFields([])
            setValues({})
            setFreeSignatures([])
            setCurrentPage(0)
            setPageCount(0)
          }}
          className="text-slate-400 hover:text-white text-sm transition-colors"
        >
          {t('common.changeFile')}
        </button>
      </div>

      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      {/* Placement mode banner */}
      {placingSigDataUrl && (
        <div className="mb-4 px-4 py-3 bg-purple-600/20 border border-purple-500/40 rounded-xl flex items-center justify-between">
          <span className="text-purple-300 text-sm">{t('fillforms.signaturePlaceHint')}</span>
          <button
            onClick={() => setPlacingSigDataUrl(null)}
            className="text-purple-400 hover:text-white text-sm transition-colors"
          >
            {t('fillforms.cancel')}
          </button>
        </div>
      )}

      {/* PDF viewer with overlay */}
      <div className="flex justify-center overflow-auto bg-slate-950/50 rounded-xl border border-slate-800/60 p-4">
        <div className="relative inline-block">
          <canvas ref={canvasRef} className="block" />
          <div
            className={`absolute top-0 left-0 ${placingSigDataUrl ? 'cursor-crosshair' : ''}`}
            style={{
              width: canvasRef.current?.width ?? 0,
              height: canvasRef.current?.height ?? 0,
            }}
            onClick={placingSigDataUrl ? handlePageClick : undefined}
          >
            {currentPageFields.map((field) => (
              <FormFieldInput
                key={fieldKey(field)}
                field={field}
                value={values[fieldKey(field)] ?? {
                  name: field.name,
                  type: field.type,
                  textValue: field.value,
                  checked: field.isChecked,
                  selected: field.selected,
                  pageIndex: field.pageIndex,
                  rect: field.rect,
                }}
                pageHeight={pageHeight}
                scale={zoom}
                onChange={(val) => handleFieldChange(field, val)}
                t={t as (key: string) => string}
              />
            ))}
            {/* Free-placed signatures on current page */}
            {freeSignatures
              .filter((s) => s.pageIndex === currentPage)
              .map((sig) => (
                <DraggableSignature
                  key={sig.id}
                  sig={sig}
                  zoom={zoom}
                  pageHeight={pageHeight}
                  onMove={handleMoveFreeSig}
                  onRemove={handleRemoveFreeSig}
                  onResize={handleResizeFreeSig}
                  t={t as (key: string) => string}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Signature drawing modal */}
      {showSigModal && (
        <SignatureModal
          onConfirm={handleSigModalConfirm}
          onCancel={() => setShowSigModal(false)}
          t={t as (key: string) => string}
        />
      )}
    </ToolLayout>
  )
}
