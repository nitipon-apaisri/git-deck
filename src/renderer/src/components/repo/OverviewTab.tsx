import { useId, useState } from 'react'
import type { AccountType, Repo, RepoSummary } from '@shared/types'
import {
  TOP_CONTRIBUTORS,
  contributorRows,
  countText,
  languageSegments,
  plural,
  statItems
} from '../../lib/repoView'
import { Avatar, Button, Skeleton, StatCard } from '../ui'
import styles from './OverviewTab.module.css'

interface OverviewTabProps {
  repo: Repo
  accountType: AccountType
  summary: RepoSummary | null
  loading: boolean
  /** A narrow pane: two columns of stat cards. */
  narrow?: boolean
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
    <div className={styles.overview}>
      <div className={styles.stats} data-narrow={narrow ? 'true' : undefined}>
        {statItems(repo, summary, accountType, loading).map((item) => (
          <StatCard
            key={item.id}
            label={item.label}
            value={typeof item.value === 'number' ? countText(item.value) : item.value}
            loading={pending && item.value === '—'}
          />
        ))}
      </div>

      <section className={styles.section} aria-labelledby={`${id}-contributors`}>
        <h2 className={styles.heading} id={`${id}-contributors`}>
          Contributors
        </h2>
        {shown.length > 0 ? (
          <>
            <ul className={styles.contributors}>
              {shown.map((c) => (
                <li key={c.key} className={styles.contributor}>
                  <Avatar src={c.avatarUrl} name={c.name} size={24} />
                  <span className={styles.name} title={c.name}>
                    {c.name}
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.barFill} style={{ width: `${c.share * 100}%` }} />
                  </span>
                  <span className={styles.commits}>{plural(c.commits, 'commit')}</span>
                </li>
              ))}
            </ul>
            <div className={styles.moreRow}>
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
                <span className={styles.muted}>
                  Showing the top {rows.length} of {countText(total)}
                </span>
              ) : null}
            </div>
          </>
        ) : pending ? (
          <ul className={styles.contributors} aria-label="Loading contributors">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className={styles.contributor}>
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
          <p className={styles.muted}>{summary ? 'No contributor data from the host.' : empty}</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby={`${id}-languages`}>
        <h2 className={styles.heading} id={`${id}-languages`}>
          Languages
        </h2>
        {segments.length > 0 ? (
          <>
            <div
              className={styles.languageBar}
              role="img"
              aria-label={`Languages: ${segments.map((s) => `${s.name} ${s.label}`).join(', ')}`}
            >
              {segments.map((s) => (
                <span
                  key={s.name}
                  className={styles.segment}
                  data-tone={s.tone}
                  style={{ flexGrow: s.percent }}
                  title={`${s.name} ${s.label}`}
                />
              ))}
            </div>
            <ul className={styles.legend}>
              {segments.map((s) => (
                <li key={s.name} className={styles.legendItem}>
                  <span className={styles.dot} data-tone={s.tone} aria-hidden="true" />
                  {s.name}
                  <span className={styles.muted}>{s.label}</span>
                </li>
              ))}
            </ul>
          </>
        ) : pending ? (
          <div className={styles.languageSkeleton}>
            <Skeleton height={8} label="Loading languages" />
            <Skeleton width="50%" />
          </div>
        ) : (
          <p className={styles.muted}>{summary ? 'No language data from the host.' : empty}</p>
        )}
      </section>

      {summary && summary.topics.length > 0 ? (
        <section className={styles.section} aria-labelledby={`${id}-topics`}>
          <h2 className={styles.heading} id={`${id}-topics`}>
            Topics
          </h2>
          <ul className={styles.topics}>
            {summary.topics.map((topic) => (
              <li key={topic} className={styles.topic}>
                {topic}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
