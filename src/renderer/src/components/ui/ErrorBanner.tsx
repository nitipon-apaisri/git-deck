import type { ReactNode } from 'react'
import { Button } from './Button'
import { Icon } from './Icon'
import styles from './ErrorBanner.module.css'

interface ErrorBannerProps {
  /** What went wrong, in words: "Could not load the summary: " plus the reason. */
  children: ReactNode
  /** Shows a Retry button. Leave it out when there is nothing to run again. */
  onRetry?: () => void
  /** Disables Retry while the retry runs. */
  retrying?: boolean
  /** A dismiss button, for a notice about something that already finished. */
  onDismiss?: () => void
  className?: string
}

/** A message with the way out: Retry runs the failed request again. */
export function ErrorBanner({
  children,
  onRetry,
  retrying = false,
  onDismiss,
  className
}: ErrorBannerProps) {
  return (
    <div role="alert" className={[styles.banner, className ?? ''].filter(Boolean).join(' ')}>
      <Icon name="alert" size="sm" />
      <span className={styles.text}>{children}</span>
      {onRetry ? (
        <Button icon="refresh" disabled={retrying} onClick={onRetry}>
          Retry
        </Button>
      ) : null}
      {onDismiss ? (
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      ) : null}
    </div>
  )
}
