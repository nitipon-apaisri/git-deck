import { useEffect, useRef, useState } from 'react'
import { IconButton } from './Button'

interface CopyButtonProps {
  text: string
  /** What is being copied, for the label: "HTTPS clone URL". */
  what: string
  /** Off inside an element that is already a live region (an alert), so it is not read twice. */
  announce?: boolean
}

const RESET_MS = 1500

export function CopyButton({ text, what, announce = true }: CopyButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), RESET_MS)
  }

  return (
    <>
      <IconButton
        label={`Copy ${what}`}
        icon={status === 'copied' ? 'check' : 'copy'}
        onClick={() => void copy()}
      />
      <span
        className="absolute size-px overflow-hidden whitespace-nowrap [clip-path:inset(50%)]"
        role={announce ? 'status' : undefined}
      >
        {status === 'copied'
          ? `Copied ${what}`
          : status === 'failed'
            ? `Could not copy ${what}`
            : ''}
      </span>
    </>
  )
}
