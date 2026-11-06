import type { PaneId } from '../../lib/splitState'
import { IconButton, Island, Spinner } from '../ui'
import styles from './EmptyPane.module.css'

export type EmptyKind = 'loading' | 'pick' | 'select'

const COPY: Record<Exclude<EmptyKind, 'loading'>, { title: string; text: string }> = {
  pick: {
    title: 'Pick a repository from the sidebar',
    text: 'It opens in this pane.'
  },
  select: {
    title: 'No repository selected',
    text: 'Choose one from the list on the left. To add an account, open Settings.'
  }
}

interface EmptyPaneProps {
  pane: PaneId
  kind: EmptyKind
  active: boolean
  onActivate: () => void
  /** Shows a close button when set (Split View only). */
  onClose?: () => void
}

/** A pane with no repository: a hint, and the place the next sidebar pick lands. */
export function EmptyPane({ pane, kind, active, onActivate, onClose }: EmptyPaneProps) {
  return (
    <Island
      className={styles.empty}
      aria-label={onClose ? `Pane ${pane + 1}, empty` : 'No repository'}
      tabIndex={-1}
      data-pane={pane}
      data-active={active}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      {onClose ? (
        <div className={styles.close}>
          <IconButton label="Close pane" icon="x" onClick={onClose} />
        </div>
      ) : null}
      {kind === 'loading' ? (
        <>
          <Spinner label="Loading repositories" />
          <p className={styles.text}>Loading repositories</p>
        </>
      ) : (
        <>
          <h1 className={styles.title}>{COPY[kind].title}</h1>
          <p className={styles.text}>{COPY[kind].text}</p>
        </>
      )}
    </Island>
  )
}
