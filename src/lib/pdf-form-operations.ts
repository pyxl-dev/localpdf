import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, PDFField } from 'pdf-lib'

const LOAD_OPTS = {
  ignoreEncryption: true,
  throwOnInvalidObject: false,
  capNumbers: true,
} as const

export type FormFieldType = 'text' | 'checkbox' | 'dropdown' | 'radio' | 'signature' | 'button'

export interface FormFieldInfo {
  name: string
  type: FormFieldType
  value: string
  isChecked: boolean
  options: string[]
  selected: string[]
  pageIndex: number
  rect: { x: number; y: number; width: number; height: number }
  readOnly: boolean
}

export interface FormFieldValue {
  name: string
  type: FormFieldType
  textValue?: string
  checked?: boolean
  selected?: string[]
  signatureDataUrl?: string
  pageIndex?: number
  rect?: { x: number; y: number; width: number; height: number }
}

function detectFieldType(field: PDFField): FormFieldType {
  if (field instanceof PDFTextField) return 'text'
  if (field instanceof PDFCheckBox) return 'checkbox'
  if (field instanceof PDFDropdown) return 'dropdown'
  if (field instanceof PDFRadioGroup) return 'radio'
  const constructorName = field.constructor.name
  if (constructorName === 'PDFSignature') return 'signature'
  return 'button'
}

function resolvePageIndex(
  widget: ReturnType<PDFField['acroField']['getWidgets']>[number],
  pages: ReturnType<PDFDocument['getPages']>,
  pdfDoc: PDFDocument,
): number {
  // Try widget.P() which returns a ref to the page
  const widgetPageRef = widget.P()
  if (widgetPageRef) {
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].ref === widgetPageRef) return i
    }
  }
  // Fallback: scan each page's Annots array for a matching widget dict
  const widgetDict = widget.dict
  for (let i = 0; i < pages.length; i++) {
    const annotsRef = pages[i].node.Annots()
    if (!annotsRef) continue
    const annots = annotsRef.asArray()
    for (const annotRef of annots) {
      const resolved = pdfDoc.context.lookup(annotRef)
      if (resolved === widgetDict) return i
    }
  }
  return 0
}

export async function extractFormFields(file: ArrayBuffer): Promise<FormFieldInfo[]> {
  const pdfDoc = await PDFDocument.load(file, LOAD_OPTS)

  let form
  try {
    form = pdfDoc.getForm()
  } catch {
    return []
  }

  const fields = form.getFields()
  if (fields.length === 0) return []

  const pages = pdfDoc.getPages()
  const result: FormFieldInfo[] = []

  for (const field of fields) {
    const type = detectFieldType(field)
    if (type === 'button') continue

    const widgets = field.acroField.getWidgets()
    if (widgets.length === 0) continue

    for (const widget of widgets) {
      const rect = widget.getRectangle()
      const pageIndex = resolvePageIndex(widget, pages, pdfDoc)

      let value = ''
      let isChecked = false
      let options: string[] = []
      let selected: string[] = []
      let readOnly = field.acroField.hasFlag(1) // Ff bit 1 = ReadOnly

      if (field instanceof PDFTextField) {
        value = field.getText() ?? ''
      } else if (field instanceof PDFCheckBox) {
        isChecked = field.isChecked()
      } else if (field instanceof PDFDropdown) {
        options = field.getOptions()
        selected = field.getSelected()
        value = selected[0] ?? ''
      } else if (field instanceof PDFRadioGroup) {
        options = field.getOptions()
        value = field.getSelected() ?? ''
        selected = value ? [value] : []
      } else if (type === 'signature') {
        readOnly = false
      }

      result.push({
        name: field.getName(),
        type,
        value,
        isChecked,
        options,
        selected,
        pageIndex,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        readOnly,
      })
    }
  }

  return result
}

export async function fillFormFields(
  file: ArrayBuffer,
  values: FormFieldValue[],
  flatten: boolean,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(file, LOAD_OPTS)
  const form = pdfDoc.getForm()

  for (const val of values) {
    try {
      if (val.type === 'text' && val.textValue !== undefined) {
        form.getTextField(val.name).setText(val.textValue)
      } else if (val.type === 'checkbox' && val.checked !== undefined) {
        const cb = form.getCheckBox(val.name)
        if (val.checked) cb.check()
        else cb.uncheck()
      } else if (val.type === 'dropdown' && val.selected !== undefined && val.selected.length > 0) {
        form.getDropdown(val.name).select(val.selected[0])
      } else if (val.type === 'radio' && val.selected !== undefined && val.selected.length > 0) {
        form.getRadioGroup(val.name).select(val.selected[0])
      }
    } catch {
      // Skip fields that can't be set (e.g. signature, removed fields)
    }
  }

  // Draw signature images directly on the pages
  const signatureValues = values.filter((v) => v.type === 'signature' && v.signatureDataUrl && v.rect)
  for (const sig of signatureValues) {
    const dataUrl = sig.signatureDataUrl!
    const rect = sig.rect!
    const pageIdx = sig.pageIndex ?? 0
    const page = pdfDoc.getPages()[pageIdx]
    if (!page) continue

    const base64 = dataUrl.split(',')[1]
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const img = await pdfDoc.embedPng(pngBytes)

    // Draw the signature image within the field rect, with some padding
    const padding = 2
    page.drawImage(img, {
      x: rect.x + padding,
      y: rect.y + padding,
      width: rect.width - padding * 2,
      height: rect.height - padding * 2,
    })
  }

  if (flatten) {
    form.flatten()
  }

  return pdfDoc.save()
}
