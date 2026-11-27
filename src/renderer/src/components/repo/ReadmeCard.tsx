import { useId, useMemo, type MouseEvent } from 'react'
import { cn } from '@/lib/cn'
import { renderMarkdown } from '../../lib/markdown'
import { useRepoReadme } from '../../state/repoData'
import { CopyButton, ErrorBanner, Icon, Skeleton } from '../ui'
import { CARD_HEADING, MUTED } from './CommitsCard'

interface ReadmeCardProps {
  repoKey: string
  linkedPath: string | undefined
  host: string
  className?: string
}

/** The README, from the linked clone or the host, rendered through the sanitizer. */
export function ReadmeCard({ repoKey, linkedPath, host, className }: ReadmeCardProps) {
  const id = useId()
  const { data, loading, error, reload } = useRepoReadme(repoKey, linkedPath)
  const html = useMemo(() => (data ? renderMarkdown(data.markdown) : ''), [data])

  // Links open in the browser, never inside the app window.
  function onClick(e: MouseEvent<HTMLDivElement>): void {
    const link = (e.target as HTMLElement).closest('a')
    if (!link) return
    e.preventDefault()
    const href = link.getAttribute('href')
    if (href) void window.api.openExternal(href)
  }

  return (
    <section
      className={cn('flex min-w-0 flex-col rounded-xl bg-(--island-raised)', className)}
      aria-labelledby={id}
    >
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-(--line) px-4 py-2">
        <h2 className={cn(CARD_HEADING, 'flex min-w-0 items-center gap-2')} id={id}>
          <Icon name="book" size="sm" />
          <span className="truncate">{data?.name ?? 'README'}</span>
        </h2>
        {data ? (
          <div className="flex flex-none items-center gap-2">
            <span className={MUTED}>
              {data.source === 'local' ? 'From the local clone' : `From ${host}`}
            </span>
            <CopyButton text={data.markdown} what="README" />
          </div>
        ) : null}
      </div>
      <div className="min-h-0 px-6 py-5">
        {error ? (
          <ErrorBanner onRetry={reload} retrying={loading}>
            Could not load the README: {error}
          </ErrorBanner>
        ) : loading && !data ? (
          <div className="flex flex-col gap-3">
            <Skeleton width="40%" height={22} label="Loading the README" />
            <Skeleton />
            <Skeleton width="85%" />
            <Skeleton width="60%" />
          </div>
        ) : data ? (
          <>
            {data.truncated ? (
              <p className={cn(MUTED, 'm-0 mb-3')}>Shown up to 512 KB. Copy has the same text.</p>
            ) : null}
            <div
              className="markdown max-h-160 overflow-auto"
              // Focusable so a long README scrolls with the keyboard.
              tabIndex={0}
              role="region"
              aria-label={data.name}
              onClick={onClick}
              // Safe: renderMarkdown drops raw HTML and keeps https links and images only.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </>
        ) : (
          <p className={cn(MUTED, 'm-0')}>No README in this repository.</p>
        )}
      </div>
    </section>
  )
}
