import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'

export async function mergePDFs(files: ArrayBuffer[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create()
  for (const file of files) {
    const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
    for (const page of pages) {
      mergedPdf.addPage(page)
    }
  }
  return mergedPdf.save()
}

export async function extractPages(
  file: ArrayBuffer,
  pageIndices: number[],
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(file, { ignoreEncryption: true })
  const newPdf = await PDFDocument.create()
  const pages = await newPdf.copyPages(srcPdf, pageIndices)
  for (const page of pages) {
    newPdf.addPage(page)
  }
  return newPdf.save()
}

export async function reorderPages(
  file: ArrayBuffer,
  newOrder: number[],
): Promise<Uint8Array> {
  const srcPdf = await PDFDocument.load(file, { ignoreEncryption: true })
  const newPdf = await PDFDocument.create()
  const pages = await newPdf.copyPages(srcPdf, newOrder)
  for (const page of pages) {
    newPdf.addPage(page)
  }
  return newPdf.save()
}

export async function rotatePages(
  file: ArrayBuffer,
  rotations: Record<number, number>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  const pages = pdf.getPages()
  for (const [index, rotation] of Object.entries(rotations)) {
    const page = pages[Number(index)]
    if (page) {
      const current = page.getRotation().angle
      page.setRotation(degrees(current + rotation))
    }
  }
  return pdf.save()
}

export async function removePages(
  file: ArrayBuffer,
  pageIndicesToRemove: number[],
): Promise<Uint8Array> {
  const sorted = [...pageIndicesToRemove].sort((a, b) => b - a)
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  for (const index of sorted) {
    pdf.removePage(index)
  }
  return pdf.save()
}

export async function imagesToPDF(
  images: { data: ArrayBuffer; type: string }[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (const image of images) {
    const isPng = image.type.includes('png')
    const img = isPng
      ? await pdf.embedPng(image.data)
      : await pdf.embedJpg(image.data)
    const page = pdf.addPage([img.width, img.height])
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
  }
  return pdf.save()
}

export interface PdfMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  creator?: string
}

export async function readMetadata(file: ArrayBuffer): Promise<PdfMetadata> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  return {
    title: pdf.getTitle() ?? '',
    author: pdf.getAuthor() ?? '',
    subject: pdf.getSubject() ?? '',
    keywords: pdf.getKeywords()?.split(',').map((k) => k.trim()) ?? [],
    creator: pdf.getCreator() ?? '',
  }
}

export async function updateMetadata(
  file: ArrayBuffer,
  metadata: PdfMetadata,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  if (metadata.title !== undefined) pdf.setTitle(metadata.title)
  if (metadata.author !== undefined) pdf.setAuthor(metadata.author)
  if (metadata.subject !== undefined) pdf.setSubject(metadata.subject)
  if (metadata.keywords !== undefined) pdf.setKeywords(metadata.keywords)
  if (metadata.creator !== undefined) pdf.setCreator(metadata.creator)
  return pdf.save()
}

export interface PageNumberOptions {
  position:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-center'
    | 'bottom-right'
  fontSize?: number
  startFrom?: number
}

export async function addPageNumbers(
  file: ArrayBuffer,
  options: PageNumberOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const pages = pdf.getPages()
  const { position, fontSize = 12, startFrom = 1 } = options

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const text = String(i + startFrom)
    const textWidth = font.widthOfTextAtSize(text, fontSize)

    let x: number
    if (position.includes('left')) x = 40
    else if (position.includes('right')) x = width - 40 - textWidth
    else x = (width - textWidth) / 2

    const y = position.includes('top') ? height - 40 : 30

    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0.4, 0.4, 0.4) })
  }

  return pdf.save()
}

export interface WatermarkOptions {
  text: string
  fontSize?: number
  opacity?: number
  rotation?: number
}

export async function addWatermark(
  file: ArrayBuffer,
  options: WatermarkOptions,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  const font = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { text, fontSize = 60, opacity = 0.15, rotation = 45 } = options
  const pages = pdf.getPages()

  for (const page of pages) {
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(rotation),
    })
  }

  return pdf.save()
}

export async function getPageCount(file: ArrayBuffer): Promise<number> {
  const pdf = await PDFDocument.load(file, { ignoreEncryption: true })
  return pdf.getPageCount()
}
