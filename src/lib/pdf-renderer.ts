import type { PDFDocumentProxy } from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function renderAllThumbnails(
  data: ArrayBuffer,
  scale = 0.3,
): Promise<string[]> {
  const uint8 = new Uint8Array(data)
  let pdf: PDFDocumentProxy | null = null
  try {
    pdf = await pdfjsLib.getDocument({ data: uint8 }).promise
    const thumbnails: string[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvas, canvasContext: ctx, viewport } as never).promise
      thumbnails.push(canvas.toDataURL('image/png'))
    }

    return thumbnails
  } finally {
    if (pdf) pdf.destroy()
  }
}
