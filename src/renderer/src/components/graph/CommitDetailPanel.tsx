import { useState } from 'react'
import type { GraphCommit } from '@shared/types'
import type { CommitDetailState } from '../../state/graphData'
import {
  FILE_LIMIT,
  additionsText,
  authorLabel,
  badgeViews,
  bodyText,
  commitDateTitle,
  deletionsText,
  fileTotals,
  fileTotalsText
} from '../../lib/graphView'
import { Avatar, Button, CopyButton, IconButton, RefBadge, Spinner } from '../ui'
import styles from './CommitDetailPanel.module.css'

interface CommitDetailPanelProps {
  commit: GraphCommit
  state: CommitDetailState
  defaultBranch: string
  onClose: () => void
}

export function CommitDetailPanel({
  commit,
  state,
  defaultBranch,
  onClose
}: CommitDetailPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const author = authorLabel(commit.author, commit.email)
  const badges = badgeViews(commit.refs, defaultBranch)
  const { detail } = state
  const body = detail ? bodyText(detail.body, commit.subject) : ''
  const files = detail?.files ?? []
  const shownFiles = showAll ? files : files.slice(0, FILE_LIMIT)

  return (
    <aside className={styles.panel} aria-label="Commit details">
      <div className={styles.header}>
        <h3 className={styles.subject}>{commit.subject || '(no message)'}</h3>
        <IconButton label="Close details" icon="x" onClick={onClose} />
      </div>

      <div className={styles.scroll}>
        <dl className={styles.meta}>
          <div className={styles.field}>
            <dt>Commit</dt>
            <dd className={styles.copyable}>
              <span className={`${styles.mono} hash`}>{commit.hash}</span>
              <CopyButton text={commit.hash} what="commit hash" />
            </dd>
          </div>
          <div className={styles.field}>
            <dt>Author</dt>
            <dd className={styles.author}>
              <Avatar name={author} size={24} />
              <span>
                {author}
                {commit.email ? (
                  <span className={styles.email}> &lt;{commit.email}&gt;</span>
                ) : null}
              </span>
            </dd>
          </div>
          <div className={styles.field}>
            <dt>Date</dt>
            <dd>{commitDateTitle(commit.date) || '—'}</dd>
          </div>
          {badges.length > 0 ? (
            <div className={styles.field}>
              <dt>Refs</dt>
              <dd className={styles.refs}>
                {badges.map((b) => (
                  <RefBadge
                    key={`${b.kind}:${b.name}`}
                    kind={b.kind}
                    name={b.name}
                    current={b.current}
                    maxLength={40}
                  />
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        {state.loading && !detail ? (
          <p className={styles.muted}>
            <Spinner label="Loading the commit" /> Loading the commit…
          </p>
        ) : null}
        {state.error ? (
          <p className={styles.error} role="alert">
            Could not read this commit: {state.error}
          </p>
        ) : null}

        {body ? <pre className={styles.body}>{body}</pre> : null}

        {detail ? (
          <section className={styles.files} aria-label="Changed files">
            <h4 className={styles.heading}>{fileTotalsText(fileTotals(files))}</h4>
            <ul className={styles.list}>
              {shownFiles.map((f) => (
                <li key={f.path} className={styles.file}>
                  <span className={styles.path} title={f.path}>
                    {f.path}
                  </span>
                  <span className={styles.counts}>
                    <span className={f.additions === null ? styles.binary : styles.added}>
                      {additionsText(f.additions)}
                    </span>
                    {f.deletions === null ? null : (
                      <span className={styles.removed}>{deletionsText(f.deletions)}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {files.length > shownFiles.length ? (
              <Button variant="ghost" onClick={() => setShowAll(true)}>
                Show all {files.length.toLocaleString('en-GB')} files
              </Button>
            ) : null}
          </section>
        ) : null}
      </div>
    </aside>
  )
}
