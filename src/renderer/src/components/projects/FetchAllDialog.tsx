import type { FetchAllState } from '../../lib/fetchAll'
import { fetchTotals, fetchTotalsText } from '../../lib/fetchAll'
import { Button, Dialog, Icon, ProgressBar, Spinner } from '../ui'

interface FetchAllDialogProps {
  state: FetchAllState
  onClose: () => void
}

/** The per-repository result of "Fetch all linked". */
export function FetchAllDialog({ state, onClose }: FetchAllDialogProps) {
  const totals = fetchTotals(state)
  const percent = totals.total === 0 ? 0 : ((totals.done + totals.failed) / totals.total) * 100
  return (
    <Dialog
      title="Fetch all linked"
      description="Runs git fetch in the local folder of each repository in this project."
      onClose={onClose}
      actions={
        <Button variant="primary" onClick={onClose}>
          {totals.finished ? 'Done' : 'Close'}
        </Button>
      }
    >
      <div className="flex items-baseline justify-between gap-3 font-medium" aria-live="polite">
        <span>{fetchTotalsText(totals)}</span>
        {!totals.finished ? (
          <span className="text-[12px] font-normal text-muted-foreground">
            Closing stops the queue.
          </span>
        ) : null}
      </div>
      <ProgressBar percent={percent} label="Fetch progress" />
      <ul className="m-0 flex list-none flex-col rounded-lg border border-border p-0">
        {state.items.map((item) => (
          <li
            key={item.key}
            className="flex items-start gap-2.5 border-t border-border px-3 py-2.5 first:border-t-0"
          >
            <span className="grid min-h-4.5 w-16 flex-none place-items-center">
              {item.status === 'running' ? <Spinner label={`Fetching ${item.name}`} /> : null}
              {item.status === 'done' ? (
                <span className="inline-grid text-(--success-text)">
                  <Icon name="check" size="sm" label="Fetched" />
                </span>
              ) : null}
              {item.status === 'failed' ? (
                <span className="inline-grid text-destructive">
                  <Icon name="alert" size="sm" label="Failed" />
                </span>
              ) : null}
              {item.status === 'queued' ? (
                <span className="text-[12px] text-muted-foreground">Waiting</span>
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{item.name}</span>
              {item.error ? (
                <span className="text-[12px] leading-4 text-destructive [overflow-wrap:anywhere]">
                  {item.error}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
