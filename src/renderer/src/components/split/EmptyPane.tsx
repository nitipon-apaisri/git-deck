import type { PaneId } from '../../lib/splitState'
import { IconButton, Island, Spinner } from '../ui'

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
      className="relative items-center justify-center gap-2 p-6 text-center"
      aria-label={onClose ? `Pane ${pane + 1}, empty` : 'No repository'}
      tabIndex={-1}
      data-pane={pane}
      data-active={active}
      onPointerDownCapture={onActivate}
      onFocusCapture={onActivate}
    >
      {onClose ? (
        <div className="absolute top-2 right-2">
          <IconButton label="Close pane" icon="x" onClick={onClose} />
        </div>
      ) : null}
      {kind === 'loading' ? (
        <>
          <Spinner label="Loading repositories" />
          <p className="m-0 text-muted-foreground">Loading repositories</p>
        </>
      ) : (
        <>
          <h1 className="m-0 text-[15px] leading-5.5 font-semibold">{COPY[kind].title}</h1>
          <p className="m-0 text-muted-foreground">{COPY[kind].text}</p>
        </>
      )}
    </Island>
  )
}
