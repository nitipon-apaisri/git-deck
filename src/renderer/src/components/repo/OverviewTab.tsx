import { useId, useState } from 'react'
import type { AccountType, Repo, RepoSummary } from '@shared/types'
import { cn } from '@/lib/cn'
import {
  TOP_CONTRIBUTORS,
  contributorRows,
  countText,
  languageSegments,
  plural,
  statItems
} from '../../lib/repoView'
import { Avatar, Button, Skeleton, StatCard } from '../ui'

interface OverviewTabProps {
  repo: Repo
  accountType: AccountType
  summary: RepoSummary | null
  loading: boolean
  /** A narrow pane: two columns of stat cards. */
  narrow?: boolean
}

const HEADING = 'm-0 text-[15px] leading-5.5 font-semibold'
const MUTED = 'm-0 text-[12px] leading-4 text-muted-foreground'
const CONTRIBUTOR =
  'grid min-h-7.5 grid-cols-[24px_minmax(80px,200px)_minmax(40px,1fr)_auto] items-center gap-2'
// Palette colour per language tone (1 to 8), shared by the bar segments and the legend dots.
const TONES: Record<number, string> = {
  1: 'bg-(--proj-blue)',
  2: 'bg-(--proj-teal)',
  3: 'bg-(--proj-violet)',
  4: 'bg-(--proj-amber)',
  5: 'bg-(--proj-rose)',
  6: 'bg-(--proj-green)',
  7: 'bg-(--proj-pink)',
  8: 'bg-(--proj-gray)'
}

export function OverviewTab({
  repo,
  accountType,
  summary,
  loading,
  narrow = false
}: OverviewTabProps) {
  // Per pane, so showing more in one pane never expands another.
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  const pending = loading && summary === null
  const empty = 'Unavailable'

  const rows = summary ? contributorRows(summary.contributors, summary.contributors.length) : []
  const shown = expanded ? rows : rows.slice(0, TOP_CONTRIBUTORS)
  const total = summary?.contributorCount ?? null
  const segments = summary ? languageSegments(summary.languages) : []

  return (
    <div className="flex flex-col gap-6">
      <div
        className={cn(
          'grid gap-2',
          narrow ? 'grid-cols-2' : 'grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
        )}
      >
        {statItems(repo, summary, accountType, loading).map((item) => (
          <StatCard
            key={item.id}
            label={item.label}
            value={typeof item.value === 'number' ? countText(item.value) : item.value}
            loading={pending && item.value === '—'}
          />
        ))}
      </div>

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-contributors`}>
        <h2 className={HEADING} id={`${id}-contributors`}>
          Contributors
        </h2>
        {shown.length > 0 ? (
          <>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {shown.map((c) => (
                <li key={c.key} className={CONTRIBUTOR}>
                  <Avatar src={c.avatarUrl} name={c.name} size={24} />
                  <span className="truncate" title={c.name}>
                    {c.name}
                  </span>
                  <span
                    className="h-1.5 overflow-hidden rounded-(--radius-xs) bg-(--neutral)"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-[inherit] bg-(--accent)"
                      style={{ width: `${c.share * 100}%` }}
                    />
                  </span>
                  <span className="min-w-20 text-right text-[12px] whitespace-nowrap text-muted-foreground">
                    {plural(c.commits, 'commit')}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              {rows.length > TOP_CONTRIBUTORS ? (
                <Button
                  variant="ghost"
                  aria-expanded={expanded}
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? 'Show fewer' : `Show more (${rows.length - TOP_CONTRIBUTORS})`}
                </Button>
              ) : null}
              {total !== null && total > rows.length ? (
                <span className={MUTED}>
                  Showing the top {rows.length} of {countText(total)}
                </span>
              ) : null}
            </div>
          </>
        ) : pending ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Loading contributors">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={CONTRIBUTOR}>
                <Skeleton
                  width={24}
                  height={24}
                  circle
                  label={i === 0 ? 'Loading contributors' : undefined}
                />
                <Skeleton width={`${70 - i * 10}%`} />
                <Skeleton height={6} />
                <Skeleton width={56} />
              </li>
            ))}
          </ul>
        ) : (
          <p className={MUTED}>{summary ? 'No contributor data from the host.' : empty}</p>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby={`${id}-languages`}>
        <h2 className={HEADING} id={`${id}-languages`}>
          Languages
        </h2>
        {segments.length > 0 ? (
          <>
            <div
              className="flex h-2.5 gap-0.5 overflow-hidden rounded-(--radius-xs)"
              role="img"
              aria-label={`Languages: ${segments.map((s) => `${s.name} ${s.label}`).join(', ')}`}
            >
              {segments.map((s) => (
                <span
                  key={s.name}
                  className={cn('min-w-[3px] basis-0', TONES[s.tone] ?? TONES[8])}
                  style={{ flexGrow: s.percent }}
                  title={`${s.name} ${s.label}`}
                />
              ))}
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0">
              {segments.map((s) => (
                <li key={s.name} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn('size-2 rounded-full', TONES[s.tone] ?? TONES[8])}
                    aria-hidden="true"
                  />
                  {s.name}
                  <span className={MUTED}>{s.label}</span>
                </li>
              ))}
            </ul>
          </>
        ) : pending ? (
          <div className="flex flex-col gap-2">
            <Skeleton height={8} label="Loading languages" />
            <Skeleton width="50%" />
          </div>
        ) : (
          <p className={MUTED}>{summary ? 'No language data from the host.' : empty}</p>
        )}
      </section>

      {summary && summary.topics.length > 0 ? (
        <section className="flex flex-col gap-2" aria-labelledby={`${id}-topics`}>
          <h2 className={HEADING} id={`${id}-topics`}>
            Topics
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {summary.topics.map((topic) => (
              <li
                key={topic}
                className="rounded-lg bg-(--selection) px-2 text-[12px] leading-5.5 text-(--accent-text)"
              >
                {topic}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
