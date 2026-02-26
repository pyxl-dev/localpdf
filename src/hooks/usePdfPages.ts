import { useState, useCallback } from 'react'
import { renderAllThumbnails } from '../lib/pdf-renderer'

export function usePdfPages() {
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const loadFile = useCallback(async (file: File) => {
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const thumbs = await renderAllThumbnails(buffer)
      setThumbnails(thumbs)
    } catch {
      setThumbnails([])
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setThumbnails([])
    setLoading(false)
  }, [])

  return { thumbnails, loading, pageCount: thumbnails.length, loadFile, reset }
}
