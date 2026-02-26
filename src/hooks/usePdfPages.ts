import { useState, useEffect } from 'react'
import { renderAllThumbnails } from '../lib/pdf-renderer'

export function usePdfPages(file: File | null) {
  const [thumbnails, setThumbnails] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!file) {
      setThumbnails([])
      return
    }

    let cancelled = false
    setLoading(true)

    file
      .arrayBuffer()
      .then((buffer) => renderAllThumbnails(buffer))
      .then((thumbs) => {
        if (!cancelled) {
          setThumbnails(thumbs)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  return { thumbnails, loading, pageCount: thumbnails.length }
}
