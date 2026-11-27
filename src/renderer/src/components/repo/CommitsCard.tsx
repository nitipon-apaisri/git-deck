import { useId, useMemo } from 'react'
import { cn } from '@/lib/cn'
import { activityStats, countText, plural } from '../../lib/repoView'
import { useRepoActivity } from '../../state/repoData'
import { Button, ErrorBanner, Heatmap, Skeleton } from '../ui'

export const CARD = 'flex min-w-0 flex-col gap-3 rounded-xl bg-(--island-raised) p-4'
export const CARD_HEADING = 'm-0 text-[15px] leading-5.5 font-semibold'
export const MUTED = 'text-[12px] leading-4 text-muted-foreground'

interface CommitsCardProps {
  repoKey: string
  linkedPath: string | undefined
  /** The account's host, named when the counts come from its API. */
  host: string
  narrow: boolean
}

/** A 12-month commit heatmap and the stats derived from it. */
export function CommitsCard({ repoKey, linkedPath, host, narrow }: CommitsCardProps) {
  const id = useId()
  const { data, loading, error, reload } = useRepoActivity(repoKey, linkedPath)
  const stats = useMemo(() => (data ? activityStats(data.days) : null), [data])
  const waiting = (loading && !data) || data?.computing === true

  const source = data
    ? data.source === 'local'
      ? 'From the local clone'
      : `From ${host}${data.truncated ? ', first 1,000 commits' : ''}`
    : null

  const statList = stats ? (
    <dl
      className={cn(
        'm-0 grid grid-cols-2 gap-x-5 gap-y-4 content-center',
        !narrow && 'max-w-85 flex-[1_1_260px] border-l border-(--line) pl-6'
      )}
    >
      {[
        { label: 'Commits', value: countText(stats.commits) },
        { label: 'Active days', value: countText(stats.activeDays) },
        { label: 'Busiest day', value: stats.busiestDay ?? '—' },
        { label: 'Current streak', value: plural(stats.streak, 'day') }
      ].map((s) => (
        <div key={s.label} className="flex flex-col-reverse">
          <dt className={MUTED}>{s.label}</dt>
          <dd className="m-0 text-[24px] leading-7.5 font-semibold">{s.value}</dd>
        </div>
      ))}
    </dl>
  ) : null

  return (
    <section className={CARD} aria-labelledby={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className={CARD_HEADING} id={id}>
          Commits <span className={cn(MUTED, 'ml-2 font-normal')}>Last 12 months</span>
        </h2>
        {source ? (
          <span className={MUTED}>
            {source}
            {data?.source === 'host' ? ' · Link a clone for exact counts' : ''}
          </span>
        ) : null}
      </div>
      {error ? (
        <ErrorBanner onRetry={reload} retrying={loading}>
          Could not load commit activity: {error}
        </ErrorBanner>
      ) : waiting ? (
        <div className="flex flex-col gap-2">
          <Skeleton height={96} label="Loading commit activity" />
          {data?.computing ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={MUTED}>{host} is still counting commits.</span>
              <Button variant="ghost" icon="refresh" onClick={reload}>
                Try again
              </Button>
            </div>
          ) : null}
        </div>
      ) : data && stats ? (
        <div className={cn('flex gap-6', narrow ? 'flex-col' : 'items-stretch')}>
          {narrow ? statList : null}
          <div className="flex min-w-0 flex-auto flex-col gap-2">
            {stats.commits === 0 ? (
              <p className={cn(MUTED, 'm-0')}>No commits in the last 12 months.</p>
            ) : null}
            <Heatmap
              days={data.days}
              noun="commit"
              label={`${plural(stats.commits, 'commit')} in the last 12 months`}
            />
          </div>
          {narrow ? null : statList}
        </div>
      ) : null}
    </section>
  )
}
