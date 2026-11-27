import { useId, useState, type ReactNode } from 'react'
import type { Account, Repo, RepoSummary } from '@shared/types'
import { cn } from '@/lib/cn'
import { timeAgo } from '../../lib/format'
import {
  TOP_CONTRIBUTORS,
  contributorRows,
  countText,
  isoDateText,
  languageSegments,
  sizeText,
  visibilityLabel
} from '../../lib/repoView'
import { useRepoTags } from '../../state/repoData'
import { useNow } from '../../state/useNow'
import { Avatar, Badge, Button, Icon, RefBadge, Skeleton } from '../ui'
import { CARD, CARD_HEADING, CommitsCard, MUTED } from './CommitsCard'
import { ReadmeCard } from './ReadmeCard'

interface OverviewTabProps {
  repo: Repo
  /** `null` if the account was just removed. */
  account: Account | null
  summary: RepoSummary | null
  loading: boolean
  linkedPath: string | undefined
  /** A narrow pane (under 760px): one column. */
  narrow?: boolean
}

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
const CHIP = 'rounded-md px-2 text-[12px] leading-5'
const RECENT_MS = 30 * 86_400_000

/** The repository dashboard: header, commit activity, README, About, Languages, Contributors. */
export function OverviewTab({
  repo,
  account,
  summary,
  loading,
  linkedPath,
  narrow = false
}: OverviewTabProps) {
  const host = account?.host ?? 'the host'
  const pending = loading && summary === null
  const topics = summary?.topics ?? []

  const about = (
    <AboutCard repo={repo} summary={summary} pending={pending} linkedPath={linkedPath} />
  )
  const languages = <LanguagesCard summary={summary} pending={pending} />
  const contributors = <ContributorsCard summary={summary} pending={pending} />
  const readme = <ReadmeCard repoKey={repo.key} linkedPath={linkedPath} host={host} />

  return (
    <div className="flex flex-col gap-4">
      <header className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="m-0 text-[22px] leading-7 font-semibold wrap-anywhere">{repo.name}</h1>
          <Badge>{visibilityLabel(repo.visibility)}</Badge>
          {repo.defaultBranch ? (
            <span
              className={cn(
                CHIP,
                'hash inline-flex items-center gap-1.5 bg-(--selection) font-mono text-(--accent-text)'
              )}
              title="Default branch"
            >
              <Icon name="git-branch" size="sm" />
              {repo.defaultBranch}
            </span>
          ) : null}
        </div>
        {repo.namespace ? <div className={cn(MUTED, 'font-mono')}>{repo.namespace}</div> : null}
        {repo.description ? (
          <p className="m-0 mt-0.5 max-w-155 wrap-anywhere">{repo.description}</p>
        ) : null}
        {topics.length > 0 ? (
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-1.5 p-0" aria-label="Topics">
            {topics.map((topic) => (
              <li key={topic} className={cn(CHIP, 'bg-(--selection) text-(--accent-text)')}>
                {topic}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <CommitsCard repoKey={repo.key} linkedPath={linkedPath} host={host} narrow={narrow} />

      {narrow ? (
        <>
          {about}
          {readme}
          {languages}
          {contributors}
        </>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
          {readme}
          <div className="flex min-w-0 flex-col gap-3">
            {about}
            {languages}
            {contributors}
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={CARD} aria-labelledby={id}>
      <h2 className={CARD_HEADING} id={id}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-5 items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 min-w-0 truncate text-right">{children}</dd>
    </div>
  )
}

function AboutCard({
  repo,
  summary,
  pending,
  linkedPath
}: {
  repo: Repo
  summary: RepoSummary | null
  pending: boolean
  linkedPath: string | undefined
}) {
  const tags = useRepoTags(repo.key, linkedPath)
  const now = useNow()
  const value = (text: string): ReactNode => (pending ? <Skeleton width={72} /> : text)
  const last = summary?.lastActivityAt ?? repo.updatedAt ?? null
  const lastAt = last ? Date.parse(last) : NaN
  const names = tags.data?.names ?? []
  const tagCount = Math.max(summary?.tagCount ?? 0, names.length)

  return (
    <Card title="About">
      <dl className="m-0 flex flex-col gap-2">
        <Row label="License">{value(summary?.license ?? '—')}</Row>
        <Row label="Created">{value(isoDateText(summary?.createdAt ?? null))}</Row>
        <Row label="Last activity">
          {value(
            Number.isNaN(lastAt)
              ? '—'
              : // Relative only while it reads well; "2117 d ago" becomes a date.
                now - lastAt < RECENT_MS
                ? timeAgo(lastAt, now)
                : isoDateText(last)
          )}
        </Row>
        <Row label="Default branch">
          {repo.defaultBranch ? (
            <span className="hash font-mono text-[12px]">{repo.defaultBranch}</span>
          ) : (
            '—'
          )}
        </Row>
        <Row label="Visibility">{visibilityLabel(repo.visibility)}</Row>
        <Row label="Size">{value(sizeText(summary?.sizeKb ?? null))}</Row>
      </dl>
      <div className="flex flex-col gap-2 border-t border-(--line) pt-3">
        <dl className="m-0">
          <Row label="Tags">
            <span className="text-muted-foreground">
              {tags.loading && !tags.data ? '' : countText(tagCount)}
            </span>
          </Row>
        </dl>
        {tags.error ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={MUTED}>Could not load tags.</span>
            <Button variant="ghost" icon="refresh" onClick={tags.reload}>
              Retry
            </Button>
          </div>
        ) : tags.loading && !tags.data ? (
          <Skeleton width="70%" label="Loading tags" />
        ) : names.length > 0 ? (
          <ul
            className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0"
            aria-label="Latest tags"
          >
            {/* The same tag badge as the graph and the Info tab. */}
            {names.map((name) => (
              <li key={name} className="flex">
                <RefBadge kind="tag" name={name} maxLength={16} />
              </li>
            ))}
            {tagCount > names.length ? (
              <li className={MUTED}>+{countText(tagCount - names.length)}</li>
            ) : null}
          </ul>
        ) : (
          <p className={cn(MUTED, 'm-0')}>No tags yet.</p>
        )}
      </div>
    </Card>
  )
}

function LanguagesCard({ summary, pending }: { summary: RepoSummary | null; pending: boolean }) {
  const segments = summary ? languageSegments(summary.languages) : []
  return (
    <Card title="Languages">
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
                className={cn('min-w-0.75 basis-0', TONES[s.tone] ?? TONES[8])}
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
        <p className={cn(MUTED, 'm-0')}>
          {summary ? 'No language data from the host.' : 'Unavailable'}
        </p>
      )}
    </Card>
  )
}

const CONTRIBUTOR = 'grid min-h-6 grid-cols-[24px_minmax(0,1fr)_96px] items-center gap-2'

function ContributorsCard({ summary, pending }: { summary: RepoSummary | null; pending: boolean }) {
  // Per pane, so showing more in one pane never expands another.
  const [expanded, setExpanded] = useState(false)
  const rows = summary ? contributorRows(summary.contributors, summary.contributors.length) : []
  const shown = expanded ? rows : rows.slice(0, TOP_CONTRIBUTORS)
  const total = summary?.contributorCount ?? null

  return (
    <Card title="Contributors">
      {shown.length > 0 ? (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
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
              </li>
            ))}
          </ul>
          {rows.length > TOP_CONTRIBUTORS || (total !== null && total > rows.length) ? (
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
                  Top {rows.length} of {countText(total)}
                </span>
              ) : null}
            </div>
          ) : null}
        </>
      ) : pending ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="Loading contributors">
          {[0, 1, 2].map((i) => (
            <li key={i} className={CONTRIBUTOR}>
              <Skeleton
                width={24}
                height={24}
                circle
                label={i === 0 ? 'Loading contributors' : undefined}
              />
              <Skeleton width={`${70 - i * 10}%`} />
              <Skeleton height={6} />
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn(MUTED, 'm-0')}>
          {summary ? 'No contributor data from the host.' : 'Unavailable'}
        </p>
      )}
    </Card>
  )
}
