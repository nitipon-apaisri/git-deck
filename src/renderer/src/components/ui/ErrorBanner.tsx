import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'

interface ErrorBannerProps {
  /** What went wrong, in words: "Could not load the summary: " plus the reason. */
  children: ReactNode
  /** Shows a Retry button. Leave it out when there is nothing to run again. */
  onRetry?: () => void
  /** Disables Retry while the retry runs. */
  retrying?: boolean
  /** A dismiss button, for a notice about something that already finished. */
  onDismiss?: () => void
  /** Adds a Copy details button for the full text, to paste into a report. */
  copyText?: string
  className?: string
}

/** shadcn's alert with the way out: Retry runs the failed request again. */
export function ErrorBanner({
  children,
  onRetry,
  retrying = false,
  onDismiss,
  copyText,
  className
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'relative flex animate-banner-in items-center gap-2 rounded-md bg-(--warning-bg) px-3 py-2 text-(--warning-text) motion-reduce:animate-none [&>svg]:flex-none',
        className
      )}
    >
      <Icon name="alert" size="sm" />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
      {onRetry ? (
        <Button icon="refresh" disabled={retrying} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      {copyText ? <CopyButton text={copyText} what="details" /> : null}
      {onDismiss ? (
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      ) : null}
    </div>
  )
}
