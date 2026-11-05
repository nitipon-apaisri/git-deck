import { useEffect, useRef, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * The size of one element, kept up to date with a `ResizeObserver`. Attach `ref` to the
 * element. A size of 0 means "not measured yet" or "hidden", and callers treat it so.
 */
export function useElementSize<T extends HTMLElement>(): ElementSize & {
  ref: React.RefObject<T | null>
} {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const width = Math.round(el.clientWidth)
      const height = Math.round(el.clientHeight)
      setSize((old) => (old.width === width && old.height === height ? old : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, ...size }
}
